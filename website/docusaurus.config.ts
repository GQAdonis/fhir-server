import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';
import inkNavyCode from './src/prism-theme';

const REPO_URL = 'https://github.com/GQAdonis/fhir-server';

const config: Config = {
  title: 'Tribe Health FHIR Server',
  tagline: 'The intermediate EHR for AI: a FHIR R4 server built in Go and backed by PostgreSQL',
  favicon: 'img/favicon.ico',
  url: process.env.DOCUSAURUS_URL ?? 'https://gqadonis.github.io',
  baseUrl: process.env.DOCUSAURUS_BASE_URL ?? '/fhir-server/',
  organizationName: 'GQAdonis',
  projectName: 'fhir-server',
  onBrokenLinks: 'throw',
  headTags: [
    {tagName: 'link', attributes: {rel: 'preconnect', href: 'https://fonts.googleapis.com'}},
    {tagName: 'link', attributes: {rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: 'anonymous'}},
    {tagName: 'link', attributes: {rel: 'apple-touch-icon', href: 'img/apple-touch-icon.png'}},
  ],
  stylesheets: [
    'https://fonts.googleapis.com/css2?family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400&display=swap',
  ],
  markdown: {mermaid: true, hooks: {onBrokenMarkdownLinks: 'throw'}},
  themes: [
    '@docusaurus/theme-mermaid',
    [
      '@easyops-cn/docusaurus-search-local',
      {
        // Offline search: the index is built at `docusaurus build` time and
        // shipped with the site, so there is no external search service.
        hashed: true,
        language: ['en'],
        indexBlog: false,
        indexPages: false,
        // Docs are served at /fhir-server/docs on GitHub Pages.
        docsRouteBasePath: '/docs',
        highlightSearchTermsOnTargetPage: true,
        explicitSearchResultPath: true,
        searchBarShortcutHint: false,
      },
    ],
  ],

  presets: [
    [
      'classic',
      {
        docs: {
          path: 'docs',
          routeBasePath: '/docs',
          sidebarPath: './sidebars.ts',
          editUrl: `${REPO_URL}/edit/main/website/`,
        },
        blog: false,
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    colorMode: {respectPrefersColorScheme: true},
    mermaid: {
      // Follow the site's light/dark mode so the diagram stays legible in both.
      theme: {light: 'neutral', dark: 'dark'},
    },
    navbar: {
      title: 'Tribe Health',
      logo: {
        alt: '',
        src: 'img/tribe-mark.png',
        srcDark: 'img/tribe-mark-dark.png',
        href: '/docs/',
        width: 32,
        height: 32,
      },
      items: [
        {
          type: 'html',
          position: 'left',
          value: '<span class="navbar-product">FHIR Server</span>',
        },
        {
          href: 'https://hl7.org/fhir/R4/',
          label: 'FHIR R4',
          position: 'right',
        },
        {
          href: REPO_URL,
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Tribe Health',
          items: [
            {label: 'tribehealth.ai', href: 'https://tribehealth.ai'},
            {label: 'Source on GitHub', href: REPO_URL},
          ],
        },
        {
          title: 'Standards',
          items: [
            {label: 'HL7 FHIR R4', href: 'https://hl7.org/fhir/R4/'},
            {label: 'Upstream WSO2 FHIR Server', href: 'https://github.com/wso2/fhir-server'},
          ],
        },
      ],
      copyright: `© ${new Date().getFullYear()} Tribe Health Solutions. Tribe Health FHIR Server is a fork of the WSO2 FHIR Server, © WSO2 LLC, licensed under Apache 2.0.`,
    },
    prism: {
      theme: inkNavyCode,
      darkTheme: inkNavyCode,
      additionalLanguages: ['bash', 'json', 'yaml'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
