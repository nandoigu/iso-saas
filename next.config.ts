/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingIncludes: {
    "/*": ["./node_modules/pdfkit/js/data/**/*"],
    // ADR-016 D1: las plantillas viajan en el bundle de las rutas que las leen.
    "/api/projects/\\[id\\]/document-templates/\\[templateId\\]/file": [
      "./docs/fuentes/plantillas-iso/**/*",
    ],
    "/api/admin/document-templates/import": ["./docs/fuentes/plantillas-iso/**/*"],
  },
};

module.exports = nextConfig;
