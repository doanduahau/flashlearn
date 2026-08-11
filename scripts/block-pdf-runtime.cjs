const Module = module.constructor;

const originalLoad = Module._load;
Module._load = function blockPdfRuntime(request, parent, isMain) {
  if (request === "pdf-parse" || request.startsWith("pdf-parse/") || request === "pdfjs-dist") {
    throw new Error("PDF runtime must not load while the isolation gate is active.");
  }

  return originalLoad.call(this, request, parent, isMain);
};
