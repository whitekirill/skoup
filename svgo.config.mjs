// Оптимизация SVG, экспортированных из Figma: npx svgo -r src/assets
export default {
  multipass: true,
  floatPrecision: 1,
  plugins: [
    {
      name: 'preset-default',
      params: { overrides: { cleanupIds: { minify: true } } },
    },
  ],
};
