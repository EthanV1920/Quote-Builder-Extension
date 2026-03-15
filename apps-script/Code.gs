function doPost(e) {
  try {
    logInfo("Received doPost request", {
      hasPostData: Boolean(e && e.postData && e.postData.contents),
      contentLength: e && e.postData && e.postData.contents ? e.postData.contents.length : 0
    });

    var payload = JSON.parse((e.postData && e.postData.contents) || "{}");
    var configuredSecret = getConfiguredSecret();
    logInfo("Parsed payload", summarizePayload(payload));

    if (!configuredSecret || payload.secret !== configuredSecret) {
      logWarn("Secret validation failed", {
        hasConfiguredSecret: Boolean(configuredSecret),
        hasPayloadSecret: Boolean(payload && payload.secret),
        payloadSecretLength: payload && payload.secret ? String(payload.secret).length : 0
      });
      return jsonResponse({ ok: false, error: "Unauthorized secret" });
    }

    var validationErrors = validatePayload(payload);
    if (validationErrors.length > 0) {
      logWarn("Payload validation failed", { validationErrors: validationErrors });
      return jsonResponse({
        ok: false,
        error: validationErrors[0],
        details: validationErrors
      });
    }

    var spreadsheet;
    try {
      spreadsheet = SpreadsheetApp.openById(payload.destination.spreadsheetId);
      logInfo("Opened spreadsheet", {
        spreadsheetId: payload.destination.spreadsheetId,
        spreadsheetName: spreadsheet.getName()
      });
    } catch (error) {
      logError("Spreadsheet open failed", {
        spreadsheetId: payload.destination.spreadsheetId,
        error: stringifyError(error)
      });
      return jsonResponse({ ok: false, error: "Spreadsheet not found" });
    }

    var sheet = spreadsheet.getSheetByName(payload.destination.sheetTabName);
    if (!sheet) {
      logWarn("Target tab not found", {
        spreadsheetId: payload.destination.spreadsheetId,
        sheetTabName: payload.destination.sheetTabName,
        availableTabs: spreadsheet.getSheets().map(function (currentSheet) {
          return currentSheet.getName();
        })
      });
      return jsonResponse({ ok: false, error: "Tab not found" });
    }

    var headerValues = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1)).getValues()[0];
    var headerMap = buildHeaderMap(headerValues);
    logInfo("Loaded sheet headers", {
      sheetTabName: payload.destination.sheetTabName,
      headers: headerValues
    });

    var missingHeaders = validateMappedHeaders(payload.destination.mapping, headerMap);
    if (missingHeaders.length > 0) {
      logWarn("Mapped headers missing from sheet", {
        requestedMapping: payload.destination.mapping,
        missingHeaders: missingHeaders,
        sheetHeaders: headerValues
      });
      return jsonResponse({
        ok: false,
        error: "Missing mapped headers",
        details: missingHeaders
      });
    }

    var rowValues = new Array(headerValues.length).fill("");
    populateRowValues(rowValues, headerMap, payload.destination.mapping, payload.item);
    logInfo("Prepared row for append", {
      sheetTabName: payload.destination.sheetTabName,
      rowValues: rowValues
    });

    sheet.appendRow(rowValues);
    var rowNumber = sheet.getLastRow();
    logInfo("Append succeeded", {
      spreadsheetId: payload.destination.spreadsheetId,
      sheetTabName: payload.destination.sheetTabName,
      rowNumber: rowNumber
    });

    return jsonResponse({ ok: true, rowNumber: rowNumber });
  } catch (error) {
    logError("Unexpected server error", {
      error: stringifyError(error),
      stack: error && error.stack ? String(error.stack) : ""
    });
    return jsonResponse({
      ok: false,
      error: "Unexpected server error",
      details: [String(error && error.message ? error.message : error)]
    });
  }
}

function validatePayload(payload) {
  var errors = [];
  if (!payload || typeof payload !== "object") {
    return ["Request body must be valid JSON."];
  }

  if (!payload.destination || typeof payload.destination !== "object") {
    errors.push("Destination is required.");
    return errors;
  }

  if (!payload.destination.spreadsheetId) {
    errors.push("Spreadsheet ID is required.");
  }

  if (!payload.destination.sheetTabName) {
    errors.push("Sheet tab name is required.");
  }

  if (!payload.destination.mapping || typeof payload.destination.mapping !== "object") {
    errors.push("Destination mapping is required.");
  } else {
    ["title", "price", "url"].forEach(function (field) {
      if (!payload.destination.mapping[field]) {
        errors.push(field.charAt(0).toUpperCase() + field.slice(1) + " mapping is required.");
      }
    });
  }

  if (!payload.item || typeof payload.item !== "object") {
    errors.push("Item payload is required.");
    return errors;
  }

  if (!payload.item.title) {
    errors.push("Missing title");
  }

  if (typeof payload.item.price !== "number" || payload.item.price <= 0) {
    errors.push("Missing price");
  }

  if (!payload.item.url) {
    errors.push("Missing url");
  }

  if (!payload.item.vendor) {
    errors.push("Missing vendor");
  }

  if (!payload.item.timestamp || isNaN(new Date(payload.item.timestamp).getTime())) {
    errors.push("Invalid timestamp");
  }

  if (
    typeof payload.item.quantity !== "number" ||
    payload.item.quantity < 1 ||
    payload.item.quantity % 1 !== 0
  ) {
    errors.push("Invalid quantity");
  }

  return errors;
}

function buildHeaderMap(headers) {
  var map = {};
  headers.forEach(function (header, index) {
    if (header) {
      map[String(header).trim()] = index;
    }
  });
  return map;
}

function validateMappedHeaders(mapping, headerMap) {
  var missing = [];
  Object.keys(mapping || {}).forEach(function (field) {
    var headerName = String(mapping[field]).trim();
    if (headerName && headerMap[headerName] === undefined) {
      missing.push("Header not found: " + headerName);
    }
  });
  return missing;
}

function populateRowValues(rowValues, headerMap, mapping, item) {
  Object.keys(mapping || {}).forEach(function (field) {
    var headerName = String(mapping[field]).trim();
    if (!headerName) {
      return;
    }

    var columnIndex = headerMap[headerName];
    if (columnIndex === undefined) {
      return;
    }

    rowValues[columnIndex] = getFieldValue(field, item);
  });
}

function getFieldValue(field, item) {
  if (field === "timestamp") {
    return new Date(item.timestamp);
  }

  return item[field] !== undefined ? item[field] : "";
}

function jsonResponse(payload) {
  return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function getConfiguredSecret() {
  var properties = PropertiesService.getScriptProperties();
  var configuredSecret =
    properties.getProperty("QUOTE_BUILDER_SECRET") ||
    properties.getProperty("QUOTE_BUILDER_SHARED_SECRET") ||
    "";

  if (!configuredSecret) {
    logWarn("No configured secret found in Script Properties", {
      checkedKeys: ["QUOTE_BUILDER_SECRET", "QUOTE_BUILDER_SHARED_SECRET"]
    });
  }

  return configuredSecret;
}

function setQuoteBuilderSecret(secret) {
  if (!secret || !String(secret).trim()) {
    throw new Error("Secret is required.");
  }

  PropertiesService.getScriptProperties().setProperty(
    "QUOTE_BUILDER_SECRET",
    String(secret).trim()
  );

  logInfo("Stored QUOTE_BUILDER_SECRET in Script Properties", {
    secretLength: String(secret).trim().length
  });
}

function summarizePayload(payload) {
  return {
    hasDestination: Boolean(payload && payload.destination),
    hasItem: Boolean(payload && payload.item),
    hasSecret: Boolean(payload && payload.secret),
    secretLength: payload && payload.secret ? String(payload.secret).length : 0,
    spreadsheetId: payload && payload.destination ? payload.destination.spreadsheetId : "",
    sheetTabName: payload && payload.destination ? payload.destination.sheetTabName : "",
    mappingKeys:
      payload && payload.destination && payload.destination.mapping
        ? Object.keys(payload.destination.mapping)
        : [],
    title: payload && payload.item ? payload.item.title : "",
    price: payload && payload.item ? payload.item.price : "",
    url: payload && payload.item ? payload.item.url : "",
    quantity: payload && payload.item ? payload.item.quantity : "",
    hasNotes: Boolean(payload && payload.item && payload.item.notes),
    timestamp: payload && payload.item ? payload.item.timestamp : ""
  };
}

function stringifyError(error) {
  if (!error) {
    return "Unknown error";
  }

  if (error.message) {
    return String(error.message);
  }

  return String(error);
}

function logInfo(message, data) {
  console.log("[Quote Builder] " + message + " :: " + JSON.stringify(data || {}));
}

function logWarn(message, data) {
  console.warn("[Quote Builder] " + message + " :: " + JSON.stringify(data || {}));
}

function logError(message, data) {
  console.error("[Quote Builder] " + message + " :: " + JSON.stringify(data || {}));
}
