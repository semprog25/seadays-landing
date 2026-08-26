#!/usr/bin/env node
'use strict';

const path = require('path');
const { rewritePublicationMetadataOnDisk } = require('./generateBlogs');

rewritePublicationMetadataOnDisk(path.join(__dirname, '..'));
console.log('Publication metadata patch complete.');
