/* eslint-disable nuxt/no-cjs-in-config */
// const path = require('path')
// const fs = require('fs')
const { DefinePlugin } = require('webpack')
const SentryPlugin = require('@sentry/webpack-plugin')
const pkg = require('./../../package.json')
const { LOCAL_LANGS } = require('./constants/lang.ts')
require('dotenv').config()

/**
 * By default, Nuxt.js is configured to cover most use cases.
 * This default configuration can be overwritten in this file
 * @link {https://nuxtjs.org/guide/configuration/}
 */

module.exports = {
  ssr: false,
  target: 'static',
  head: {
    title: 'M³',
    titleTemplate: '%s - Meeting Media Manager',
    meta: [
      { charset: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      {
        hid: 'description',
        name: 'description',
        content: 'Meeting Media Manager',
      },
    ],
  },
  loading: false,
  components: true,
  vue: {
    config: {
      runtimeCompiler: true,
    },
  },
  router: {
    middleware: ['reminders', 'allowQuit'],
  },
  css: [
    '@fortawesome/fontawesome-svg-core/styles.css',
    '~/assets/scss/main.scss',
  ],
  plugins: [
    // No dependencies
    '~/plugins/sentry',
    '~/plugins/externals',
    '~/plugins/axios',
    '~/plugins/dayjs',
    '~/plugins/helpers',
    '~/plugins/prefs',
    // Depends on prefs
    '~/plugins/logger',
    // Depends on logger
    '~/plugins/db',
    '~/plugins/fs',
    '~/plugins/notify',
    // Depends on db/fs/notify/
    '~/plugins/cong',
    '~/plugins/converters',
    '~/plugins/jw',
    // Depends on jw
    '~/plugins/media',
    '~/plugins/present',
    // Depends on present
    '~/plugins/obs',
  ],

  buildModules: ['@nuxt/typescript-build'],
  modules: [
    '@nuxtjs/axios',
    '@nuxtjs/dayjs',
    '@nuxtjs/i18n',
    '@nuxtjs/vuetify',
  ],

  dayjs: {
    locales: LOCAL_LANGS,
    defaultLocale: 'en',
    plugins: [
      'customParseFormat',
      'duration',
      'isBetween',
      'isSameOrBefore',
      'isoWeek',
      'localeData',
      'updateLocale',
    ],
  },

  vuetify: {
    defaultAssets: {
      icons: false,
    },
    optionsPath: '~/vuetify.options.js',
    customVariables: ['~/assets/scss/variables.scss'],
  },

  i18n: {
    langDir: '~/locales/',
    defaultLocale: 'en',
    lazy: true,
    vueI18n: {
      fallbackLocale: 'en',
    },
    locales: [
      { code: 'de', iso: 'de-DE', file: 'de.json', name: 'Deutsch (German)' },
      { code: 'en', iso: 'en-US', file: 'en.json', name: 'English (English)' },
      { code: 'es', iso: 'es-ES', file: 'es.json', name: 'español (Spanish)' },
      { code: 'et', iso: 'et-EE', file: 'et.json', name: 'eesti (Estonian)' },
      { code: 'fi', iso: 'fi-FI', file: 'fi.json', name: 'suomi (Finnish)' },
      { code: 'fr', iso: 'fr-FR', file: 'fr.json', name: 'Français (French)' },
      { code: 'it', iso: 'it-IT', file: 'it.json', name: 'Italiano (Italian)' },
      { code: 'nl', iso: 'nl-NL', file: 'nl.json', name: 'Nederlands (Dutch)' },
      {
        code: 'pt-pt',
        iso: 'pt-PT',
        file: 'pt-pt.json',
        name: 'Português - Portugal (Portuguese - Portugal)',
      },
      {
        code: 'pt',
        iso: 'pt-BR',
        file: 'pt.json',
        name: 'Português - Brasil (Portuguese - Brazil)',
      },
      { code: 'ru', iso: 'ru-RU', file: 'ru.json', name: 'русский (Russian)' },
      { code: 'sv', iso: 'sv-SE', file: 'sv.json', name: 'Svenska (Swedish)' },
    ],
  },
  /*
  server: {
    https: {
      key: fs.readFileSync(path.resolve(__dirname, 'ssl', 'server.key'), {
        encoding: 'utf8',
      }),
      cert: fs.readFileSync(path.resolve(__dirname, 'ssl', 'server.crt'), {
        encoding: 'utf8',
      }),
    },
  },
*/
  generate: {
    fallback: true, // 404 page
  },
  build: {
    babel: {
      // envName: server, client, modern
      presets({ envName }) {
        const envTargets = {
          client: { browsers: ['Chrome >= 104'] },
          server: { node: 'current' },
        }
        return [
          [
            '@nuxt/babel-preset-app',
            {
              corejs: { version: 3 },
              shippedProposals: true,
              targets: envTargets[envName],
            },
          ],
        ]
      },
    },
    extend(config, { isClient }) {
      config.module = {
        ...config.module,
        noParse: [
          /node_modules\/?\\?pdfjs-dist\/?\\?build\/?\\?pdf/,
          /node_modules\/?\\?sql\.js\/?\\?dist\/?\\?sql-wasm/,
        ],
      }
      if (isClient) {
        config.devtool = 'source-map'
      }
    },
    plugins: [
      new DefinePlugin({
        'process.env.FLUENTFFMPEG_COV': JSON.stringify(false),
      }),
      new DefinePlugin({
        __SENTRY_DEBUG__: false,
        __SENTRY_TRACING__: false,
      }),
      new SentryPlugin({
        release: 'meeting-media-manager@' + pkg.version,
        include: './dist',
      }),
    ],
    externals: [
      function ({ request }, callback) {
        const IGNORES = ['fluent-ffmpeg']
        if (IGNORES.includes(request)) {
          return callback(null, `require('${request}')`)
        }
        return callback()
      },
    ],
  },
  publicRuntimeConfig: {
    author: pkg.author.name,
    isDev: process.env.NODE_ENV !== 'production',
    name: pkg.name,
    repo: pkg.repository.url
      .replace('mtdvlpr', 'sircharlo')
      .replace('.git', ''),
    version: 'v' + pkg.version,
    sentryDSN: process.env.SENTRY_DSN,
    env: process.env,
  },
}
