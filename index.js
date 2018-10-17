const AxeBuilder = require('axe-webdriverjs');
const WebDriver = require('selenium-webdriver');
const sites = require('./sites.json');
const run_time = Date.now();
const fs = require('fs');


sites.forEach(site => {
    let driver = new WebDriver.Builder()
    .forBrowser('chrome')
    .build();
    if (site && site.url){
        runSiteTest(driver,site).then(() =>{
            driver.quit()
        }) 
    }

});
       
function getUrlList(){
    return new Promise((res, rej)=>{
        driver.findElements(WebDriver.By.tagName('a')).then(function(elements){
            for (var i = 0, j = elements.length; i < j; i++){
                elements[i].getAttribute('href').then(function(href){
                    
                })
            }
        })
    })
}


function runSiteTest(driver, siteObj){

    return new Promise((res,rej) => {
        driver
        .get(siteObj.url)
        .then(function () {
            getPageUrlList(driver, siteObj).then(function(){

            })
            
               
                
            
          AxeBuilder(driver)
            .analyze(function (results) {
                console.log('analyzed')
                  // add a line to a lyric file, using appendFile
                if (results && results.violations){
                    let outStr = `/\\/\\/\\/\\/\\/\\/\\/\\/\\ \nURL: ${results.url} \n`
                    let violas = results.violations
                    for (var i = 0, j = violas.length; i < j; i++){
                        outStr += '\n\n---------------------------------\n\n'  
                        outStr += `desc: ${violas[i].description} \n`
                        outStr += `help: ${violas[i].help},\n`
                        outStr += `helpUrl: ${violas[i].helpUrl},\n`
                        outStr += `tags: ${violas[i].tags.join(', ')},\n`
                        outStr += `nodes: \n ${getNodeOutput(violas[i].nodes)}\n`
                        outStr += '\n\n---------------------------------\n\n'  
                    
                    }
                    outStr += '/\\/\\/\\/\\/\\/\\/\\/\\/\\ \n\n'
                    fs.appendFile(siteObj.resultsFolder +'/results_'+ run_time + '.txt', outStr, (err) => {  
                        if (err) rej();
                        res()
                    });                
                }


          });
        });
    })
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





  