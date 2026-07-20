import { parse } from 'yaml';

const materialPythonNameTags = [
  {
    resolve: () => 'material.extensions.emoji.twemoji',
    tag: 'tag:yaml.org,2002:python/name:material.extensions.emoji.twemoji',
  },
  {
    resolve: () => 'material.extensions.emoji.to_svg',
    tag: 'tag:yaml.org,2002:python/name:material.extensions.emoji.to_svg',
  },
];

/**
 * Parses MkDocs configuration while recognizing Material's Python-name YAML tags.
 *
 * @param {string} source The MkDocs YAML source.
 * @returns {unknown} The parsed configuration.
 */
export function parseMkDocsConfiguration(source) {
  return /** @type {unknown} */ (parse(source, { customTags: materialPythonNameTags }));
}
