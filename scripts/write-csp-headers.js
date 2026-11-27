#!/usr/bin/env node
// Writes public/_headers, which Cloudflare Pages reads, from config/csp.js.
const fs = require('fs');
const path = require('path');
const { cloudflareHeadersFile } = require('../config/csp');

fs.writeFileSync(path.join(__dirname, '..', 'public', '_headers'), cloudflareHeadersFile());
