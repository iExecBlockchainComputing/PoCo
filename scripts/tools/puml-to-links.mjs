#!/usr/bin/env zx

// TODO update and fix this script.

// Render .puml files (referenced in markdown comments) to web links
// Usage: "npm run puml2links" or "npx zx scripts/tools/puml-to-links.mjs"
// Note:
// Using server-side rendering with `puml-for-markdown` since `node-plantuml``
// requires Java on host. See https://github.com/danielyaa5/puml-for-markdown
// Note:
// To ensure freshness of a parent diagram, it might be necessary to
// remove everything before <!--![ABC](./abc.puml)--> from
// [![ABC](https://tinyurl.com/abcdef)](https://tinyurl.com/abcdef)<!--![ABC](./abc.puml)-->
// in order to force recreation of this parent diagram made of updated and
// included child diagrams.


$.verbose = false // Disable bash commands logging.

const projectRootDir = await $`dirname ${__dirname}`
// Search for markdown files and update puml links.
const output = await $`npx puml-for-markdown -x ${projectRootDir}/docs/`
console.log(output.toString());
