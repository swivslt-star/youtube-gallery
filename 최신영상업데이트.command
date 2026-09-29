#!/bin/bash
cd "$(dirname "$0")/youtubegallery"
node sync.js
node sync1000.js
node generate_counts.js
