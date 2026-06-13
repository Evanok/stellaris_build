import purgecss from '@fullhuman/postcss-purgecss';

export default {
  plugins: [
    ...(process.env.NODE_ENV === 'production' ? [
      purgecss({
        content: [
          './index.html',
          './src/**/*.{ts,tsx}',
        ],
        safelist: {
          standard: [/^modal/, /^show/, /^fade/, /^collapse/, /^collapsing/, /^offcanvas/, /^carousel/],
          deep: [/data-bs/, /^bs-/],
          greedy: [/^btn-close/, /^visually-hidden/, /^active/, /^disabled/],
        },
        defaultExtractor: content => content.match(/[\w-/:]+(?<!:)/g) || [],
      })
    ] : []),
  ],
};
