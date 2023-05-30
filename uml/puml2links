#!/bin/bash
# Render .puml files (found in markdown comments) to web links

cd $(dirname $0)

# Using server-side rendering with `puml-for-markdown` since `node-plantuml`` 
# requires Java on host
# See https://github.com/danielyaa5/puml-for-markdown
#
# Search for markdown in current dir
npx puml-for-markdown

#TODO: Add this script to pre-commit hook in order to keep up-to-date links

# Note: To ensure freshness of a parent diagram, it might be necessary to 
# remove everyting before
# <!--![ABC](./abc.puml)-->
# from
# [![ABC](https://tinyurl.com/abcdef)](https://tinyurl.com/abcdef)<!--![ABC](./abc.puml)-->
# in order to force recreation of this parent diagram made of updated and 
# included child diagrams.
