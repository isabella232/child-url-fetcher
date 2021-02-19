const urlLib = require('url')

const fetchLib = require('node-fetch')
const puppeteerLib = require('puppeteer-core')
const randomJsLib = require('random-js')
const tldjsLib = require('tldjs')

const looksLikePageLink = async url => {
  try {
    const result = await fetchLib(url, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 11_1_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/89.0.4389.48 Safari/537.36'
      }
    })
    const contentType = result.headers['content-type']
    const isHtmlPage = contentType && contentType.includes('text/html')
    if (isHtmlPage === false) {
      console.error(`URL doesn't seem to point to a page: ${url}`)
    }
    return isHtmlPage
  } catch (error) {
    console.error(error)
    return false
  }
}

const getETldPlusOneLinks = async page => {
  let links
  try {
    links = await page.$$('a[href]')
  } catch (e) {
    return []
  }

  const pageUrl = page.url()
  const mainETld = tldjsLib.getDomain(pageUrl)
  const sameETldLinks = new Set()

  for (const aLink of links) {
    const hrefHandle = await aLink.getProperty('href')
    const hrefValue = await hrefHandle.jsonValue()
    try {
      const hrefUrl = new urlLib.URL(hrefValue.trim(), pageUrl)
      hrefUrl.hash = ''
      hrefUrl.search = ''

      if (hrefUrl.protocol !== 'http:' && hrefUrl.protocol !== 'https:') {
        continue
      }

      const childUrlString = hrefUrl.toString()
      const childLinkETld = tldjsLib.getDomain(childUrlString)
      if (childLinkETld !== mainETld) {
        continue
      }
      if (!childUrlString || childUrlString.length === 0) {
        continue
      }
      sameETldLinks.add(childUrlString)
    } catch (_) {
      continue
    }
  }

  return Array.from(sameETldLinks)
}

const getSameSiteUrls = async (page, url, waitSecs) => {
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' })
    const waitTimeMs = waitSecs * 1000
    await page.waitForTimeout(waitTimeMs)
    return await getETldPlusOneLinks(page)
  } catch (error) {
    console.error(error)
    return []
  }
}

const start = async (binaryPath, url, waitSecs, numLinks, headless) => {
  const puppeteerArgs = {
    defaultViewport: null,
    args: [
      '--disable-brave-update'
    ],
    executablePath: binaryPath,
    ignoreDefaultArgs: [
      '--disable-sync'
    ],
    headless: !!headless
  }

  const browser = await puppeteerLib.launch(puppeteerArgs)
  const page = await browser.newPage()

  const tearDown = async _ => {
    await page.close()
    await browser.close()
  }

  const report = {
    landingPage: url,
    childPages: []
  }

  const randomGenerator = new randomJsLib.Random()
  let currentUrl = url
  while (true) {
    let childUrls = await getSameSiteUrls(page, currentUrl, waitSecs)
    let nextUrl = null
    if (childUrls.length === 0) {
      console.error(`Wasn't able to find any same-site urls on ${currentUrl}`)
      await tearDown()
      return report
    }

    while (childUrls.length > 0) {
      const selectedUrl = randomGenerator.pick(childUrls)
      childUrls = Array.from(new Set(childUrls).delete(selectedUrl))
      // If its a URL we've visited previously, discard and try another one.
      if (report.childPages.includes(selectedUrl) === true) {
        continue
      }

      // If it doesn't look like the URL points to another page, discard
      // and try another one.
      const isPageLink = await looksLikePageLink(selectedUrl)
      if (isPageLink === false) {
        continue
      }

      report.childPages.push(selectedUrl)
      nextUrl = selectedUrl
      break
    }

    if (report.childPages.length === numLinks) {
      // Mission complete!
      await tearDown()
      return report
    }

    // We didn't find a new URL to search from...
    if (nextUrl === null) {
      console.error(`was not able to find another same-site URL on ${currentUrl}`)
      await tearDown()
      return report
    }

    currentUrl = nextUrl
  }
}

module.exports = {
  start
}
