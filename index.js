const AxeBuilder = require('axe-webdriverjs');
const WebDriver = require('selenium-webdriver');
const axios = require('axios');
const validator = require('html-validator')
const sites = require('./sites.json');
const run_time = Date.now();
const fs = require('fs');
const resultsFolder = './scan_results'

fsMakeDirExist(resultsFolder);

var siteObj = sites[0];
runSiteTest(siteObj, () => {
    writeUrlList(siteObj);
    writeBadUrlList(siteObj);
    writeSiteMap(siteObj);
}).then(() => {

});


async function runSiteTest(siteObj, callback){
        siteObj.urlList = [];
        siteObj.siteMap = [];
        siteObj.skippedUrlList = [];
        setupClubDir(siteObj)
        getUrlObjFromList(siteObj.startUrl,siteObj.urlList)
        var driver = buildDriver();
        await driver.get(siteObj.loginurl)
        .then(async function (){
            await new Promise(async (res,rej) => {
                await driver.findElements(WebDriver.By.css('#login_username_main')).then((elements)=>{
                
                    elements[0].clear()
                    elements[0].sendKeys(siteObj.username)
                });
                await driver.findElements(WebDriver.By.css('#login_password_main')).then((elements)=>{
                    
                    elements[0].clear()
                    elements[0].sendKeys(siteObj.password)
                });
                
                await driver.findElements(WebDriver.By.css('#frmLogin button[type="submit"]')).then((el) => {
                    el[0].click()
                    setTimeout(() => res(), 5000)
                })
            })

            var doLoop = callNext(siteObj);
            var counter = 0;
    
            while (doLoop && counter < 3){
                await runUrlTest(doLoop.url, siteObj, driver)
                doLoop = callNext(siteObj)
                counter++
            }
            driver.close().then(()=>{
                callback()
            })
            
        })
        

        
}

function runValidator(url, data){
    return new Promise((res, rej) => {

        let options = {
            data:data,
            format: 'json'
        }
        validator(options)
        .then((d) => {
            res(d)
        })
        .catch((e) => {
            console.error(e)
            rej(e)
        })
    })
}

function runUrlTest(url, siteObj, driver) {
    return new Promise((res, rej) => {
        let currentUrl = getUrlObjFromList(url, siteObj.urlList)
        if (currentUrl.checked){
            return res()             
        } 
        currentUrl.checked = true
        
        driver
        .get(url)
        .then(function () {
            let movingForward = new Promise((res, rej) => {
                driver.findElements(WebDriver.By.tagName('html')).then((elements)=>{
                    elements[0].getAttribute('class').then((d) =>{
                        if(d.includes('404')){
                            rej();
                        } else {
                            res();
                        }
                    })
                })
            })
            movingForward.then(()=>{
                currentUrl.status = 'valid';
                if( url.slice(0, siteObj.rootUrl.length) !== siteObj.rootUrl){
                    // if the validated site isn't one of ours, we should still log whether it's a valid URL, but not do the rest of the audit
                    return res()                 
                }

            let src = driver.getPageSource()
            src.then((d) => {
                runValidator(url,d)
                .then((d) => {
                    

                    var currentPage = {
                        name:'',
                        url:url,
                        resolvedUrl: '',
                        urlList: []
                    }
                    siteObj.siteMap.push(currentPage);
            
                    var folderName = buildFolderName(url, siteObj);
                    fs.appendFile(folderName+'/html_validator.json', JSON.stringify(d), (err) => {  
                        if(err){console.log(err)}
                        
                    });  
                    // store resolved url
                    var getCurrentUrl = driver.getCurrentUrl()
                    getCurrentUrl.then(function(d){
                        currentPage.resolvedUrl = d;
                    });
                    // run Axe
                    var grindTheaXe = runAxeTest(driver, folderName)
                    
                    // get list of site urls
                    // - build map 
                    // - add to to-do array
                    
                    var buildUrlList = getPageUrlList(driver, url,  siteObj, currentPage)
                    Promise.all([getCurrentUrl,grindTheaXe,buildUrlList]).then(() => {
                        // driver.close().then(() => {
                            
                            return res()

                        // })
                    })
                })
            })
        }).catch((e) =>{
            console.log(e)
            currentUrl.status = ' 404 - INVALID';
            
            return res()
        })
              
        }).catch(() => {
            currentUrl.status = ' 404 - INVALID';
            
            return res()
        })
    })  

}
function callNext(siteObj){
    let nextUrl = getNextUrl(siteObj)
    if(isNaN(+nextUrl)){
        return nextUrl
    }
    return false
}
function getNextUrl(siteObj){
    var outObj;

    for(i = 0, j = siteObj.urlList, k = j.length; i < k; i++ ){
        if(!j[i].checked){
            if(j[i].url.indexOf('login') > -1){
                j[i].checked = true
                       
            } else {
                outObj = j[i]
                break    
            }
        }
    }
    if( outObj){
        return outObj
    } else {
        return -1
    }
}
function getPageUrlList(driver, currentUrl, siteObj, currentPage){
    return new Promise((res, rej) =>{
        driver.findElements(WebDriver.By.tagName('a')).then(function(elements){
            for (var i = 0, j = elements.length; i < j; i++){
                elements[i].getAttribute('href').then(function(href){
                    if(determineIfUrlShouldBeTested(href)){
                        getUrlObjFromList(href, siteObj.urlList);
                        currentPage.urlList.push(href)
                    } else {
                        siteObj.skippedUrlList.push({currentUrl, href })   
                    }
                })
            }
            res()
        })
    })
}

function determineIfUrlShouldBeTested(inUrl){
        var isBad = !inUrl;
        isBad = !inUrl
        isBad = isBad || (inUrl.slice(0,3) !== 'htt')

        return !isBad
}

function runAxeTest(driver, folderName){
    return new Promise((res, rej ) => {
        AxeBuilder(driver)
            .analyze(function (results) {
                    // add a line to a lyric file, using appendFile
                if (results && results.violations){
                    // let outStr = `/\\/\\/\\/\\/\\/\\/\\/\\/\\ \nURL: ${results.url} \n`
                    // let violas = results.violations
                    // for (var i = 0, j = violas.length; i < j; i++){
                    //     outStr += '\n\n---------------------------------\n\n'  
                    //     outStr += `desc: ${violas[i].description} \n`
                    //     outStr += `help: ${violas[i].help},\n`
                    //     outStr += `helpUrl: ${violas[i].helpUrl},\n`
                    //     outStr += `tags: ${violas[i].tags.join(', ')},\n`
                    //     outStr += `nodes: \n ${getNodeOutput(violas[i].nodes)}\n`
                    //     outStr += '\n\n---------------------------------\n\n'  
                    
                    // }
                    // outStr += '/\\/\\/\\/\\/\\/\\/\\/\\/\\ \n\n'
                    let outStr = JSON.stringify(results);

                    fs.appendFile(folderName+'/aXe_validator.json', outStr, (err) => {  
                        if (err) rej();
                        res()
                    });                
                }


            });
        });
  
}
function getNodeOutput(inArr){
    let tmpOut = ""
   
    for (var i = 0, j = inArr.length; i < j ; i++){
        let ruleList = inArr[i].any.map((ruleObj) => {
            let outStr = `\t\timpact: ${ruleObj.impact}, \n`
            outStr += `\t\tmessage: ${ruleObj.message},\n`
            outStr += `\t\trelatedNodes: ${ruleObj.relatedNodes.length ? ruleObj.relatedNodes.map((obj) => {
                return `\n\t\t\thtml: ${obj.html}, \n\t\t\ttarget: ${obj.target.join(', ')}`}) : ''
            }\n`
            
            return outStr;
        })
        
        let tmpStr = '\n*****\n';
        tmpStr += `\tFailure Summary: ${inArr[i].failureSummary},\n`
        tmpStr += `\trules: \n${ruleList.join('\n')}\n`
        tmpStr += `\thtml: ${inArr[i].html},\n`
        tmpStr += `\ttarget: ${inArr[i].target.join(', ')}\n`
        tmpStr += '\n*****\n';
                
        tmpOut += tmpStr
    }
    return tmpOut;
}

function fsMakeDirExist(path){
    try {
        fs.accessSync(path);
    } catch (e) {
        fs.mkdirSync(path);
    }
}
function buildDriver (){
    let driver = new WebDriver.Builder()
    .forBrowser('chrome')
    .build();
    return driver;
}
function setupClubDir(siteObj){
    fsMakeDirExist(resultsFolder + '/' + siteObj.resultsFolder);

    siteObj.runtimeFolder = resultsFolder + '/' + siteObj.resultsFolder+'/'+run_time;
    fsMakeDirExist(siteObj.runtimeFolder);

    siteObj.urlListFile = siteObj.runtimeFolder + '/url_list.text';
    fs.writeFileSync(siteObj.urlListFile ,'');

    siteObj.skippedUrlListFile = siteObj.runtimeFolder + '/skipped_url_list.text';
    fs.writeFileSync(siteObj.skippedUrlListFile ,'');

    siteObj.siteMapFile = siteObj.runtimeFolder + '/sitemap.text';
    fs.writeFileSync(siteObj.siteMapFile,'');

} 
function makePrettyObj(obj){
    return JSON.stringify(obj).replace('{',"{\n\t").replace('}','\n}\n').replace(/,/g, ',\n\t').replace('[','[\n\t\t').replace('],','],\t\n\t').replace(/\\t\\t/g, '\t\t')
}
function writeUrlList(siteObj){
    return new Promise((res, rej) => {
        let urlString = siteObj.urlList.map((urlObj) => {
            return makePrettyObj(urlObj)
        }).join('\n');
        fs.appendFile(siteObj.urlListFile, urlString, (err) => {  
            if (err) rej();
            res()
        });
    });
}
function writeBadUrlList(siteObj){
    return new Promise((res, rej) => {
        let urlString = siteObj.skippedUrlList.map((urlObj) => {
            return makePrettyObj(urlObj)
        }).join('\n');
        fs.appendFile(siteObj.skippedUrlListFile, urlString, (err) => {  
            if (err) rej();
            res()
        });
    });
}
function writeSiteMap(siteObj){
    return new Promise((res, rej) => {
        let urlString = siteObj.siteMap.map((urlObj) => {
            urlObj.urlList = urlObj.urlList.join(',\t\t')
            return makePrettyObj(urlObj)
        }).join('\n');
        fs.appendFile(siteObj.siteMapFile, urlString, (err) => {  
            if (err) rej();
            res()
        });
    });
}
function buildFolderName(url, siteObj){
    let folderName = url.replace('http://','').replace('https://','').replace(/\./g,'*').replace(/\//g, '-')
    folderName = siteObj.runtimeFolder+'/'+folderName
    fsMakeDirExist(folderName);
    return folderName
}
function getUrlObjFromList(url, inArr){
    let inList = [];
    if (inArr.length) {
        for(var i = 0, j = inArr.length; i < j; i++){
            if(inArr[i].url.toUpperCase() == url.toUpperCase()){
                inList.push(i);
            }
        }
    }
    if (inList.length > 0){
        // something weird happened where we added the url a second time
        return inArr[inList[0]]
    } else {
        var newObj = {
            url, 
            status: '',
            checked: false
        }
        inArr.push(newObj)
        return newObj;
    }
}