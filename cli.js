#!/usr/bin/env node

const argParseLib = require('argparse')

const braveCrawlLib = require('./brave/crawl')

const parser = new argParseLib.ArgumentParser({
  addHelp: true
})
parser.addArgument(['-b', '--binary'], {
  help: 'Path to the puppeteer compatible binary to test with.',
  required: true
})
parser.addArgument(['-n', '--num'], {
  help: 'The number of child pages to try and fetch.',
  defaultValue: 5,
  type: 'int'
})
parser.addArgument(['-u', '--url'], {
  help: 'A complete URL to start crawling from.',
  require: true
})
parser.addArgument(['--visible'], {
  help: 'If provided, do not use headless mode.',
  action: 'storeTrue'
})
parser.addArgument(['-s', '--sec'], {
  help: 'Number of seconds to pause on a page before looking for links.',
  defaultValue: 10,
  type: 'int'
})

const args = parser.parseArgs();

(async _ => {
  const { binary, url, sec, num } = args
  const report = await braveCrawlLib.start(binary, url, sec, num, !args.visible)
  console.log(JSON.stringify(report))
})()
