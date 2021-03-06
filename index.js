
const util = require('util');
const process=require('process');
const path=require('path');
const fs=require('fs');
const https=require('https');
const http=require('http');
const url=require('url');

const exec = promisify(require('child_process').exec); 
const writeFile = promisify(fs.writeFile); 

function promisify(_obj){ return util.promisify(_obj) }

const config = {
    gitV:'2.19.1',
    gitAddresses:[],
    path:['/Git/bin;'],//暴露的环境变量
}

class OneKey {
    constructor(){
        this.platform='windows';
    }
    // 判断系统位数
    is64(){
        // 'arm', 'arm64', 'ia32', 'mips', 'mipsel', 'ppc', 'ppc64', 's390', 's390x', 'x32', 'x64'。
        return ['64','mipsel','s390x'].some(x=>process.arch.indexOf(x)==1)
    }
    // 判断平台
    whatPlatform(){
        switch(process.platform){
            case 'win32':
                this.platform='windows';
                break;
            case 'darwin':
                this.platform='mac'
                break;
            default:
                throw new Error('暂不兼容除了windows,mac外的其他操作系统')
        }
        console.log('当前操作系统是: '+this.platform)
    }
    // 添加环境变量
    setPATH(){
        //git path
        config.path.forEach(x=>{
            process.env.PATH += ';'+process.env.ProgramFiles + x
        })
    }
    // 下载cnpm
    async downloadCNPM(){
        try{// console.log('已经安装cnpm')
            await exec('cnpm')
        }catch(error){//如果没有安装cnpm
            await exec('npm install -g cnpm --registry=https://registry.npm.taobao.org')
                .catch(rej=>{throw new Error('cnpm初始化错误\n'+rej)})
        }
        console.log('                                              ------cnpm初始化完毕')
    }
    // 下载yarn
    async downloadYARN(){
        try{// console.log('已经安装cnpm')
            await exec('yarn')
        }catch(error){//如果没有安装cnpm
            await exec('npm install -g yarn')
                .catch(rej=>{throw new Error('yarn初始化错误\n'+rej)})
        }
        console.log('                                              ------yarn初始化完毕')
    }
    // 下载npm模块 暂时不用 以后可能需要依赖某些模块时才使用
    async downloadModules(){
        try {
            require('axios');
        } catch (error) {
            await exec('yarn add axios')
                .catch(rej=>{throw new Error('axios初始化错误\n'+rej)})
        }
        console.log('                                              ------axios初始化完毕')
    }
    // 下载git
    async downloadGit(){
        let name, tempUrl, openMethod;
        switch(this.platform){
            case 'windows':
                name=this.is64()
                    ?'Git-'+config.gitV+'-64-bit.exe'
                    :'Git-'+config.gitV+'-32-bit.exe'
                openMethod='start '+name
                // tempUrl='https://npm.taobao.org/mirrors/git-for-windows/v'+config.gitV+'.windows.1/Git-'+config.gitV+'-64-bit.exe' //这条链接被跳转
                tempUrl=this.is64()
                    ?'https://npm.taobao.org/mirrors/git-for-windows/v'+config.gitV+'.windows.1/Git-'+config.gitV+'-64-bit.exe'
                    :'https://npm.taobao.org/mirrors/git-for-windows/v'+config.gitV+'.windows.1/Git-'+config.gitV+'-32-bit.exe'
                break;
            case 'mac':
                name='git-'+config.gitV+'-intel-universal-mavericks.dmg';
                openMethod='open '+name
                tempUrl='https://jaist.dl.sourceforge.net/project/git-osx-installer/git-'+config.gitV+'-intel-universal-mavericks.dmg'
                break;
        }
        await this.download(tempUrl,name)
        exec(openMethod)
        console.log('                                              ------git初始化完毕')
    }
    // 下载vsc
    async downloadVSC(){
        let name, tempUrl, openMethod;
        switch(this.platform){
            case 'windows':
                name=this.is64()
                    ?'VSCodeSetup-x64-1.23.0.exe'
                    :'VSCodeSetup-ia32-1.23.0.exe'
                openMethod='start '+name
                tempUrl=this.is64()
                    ?'https://vscode.cdn.azure.cn/stable/dea8705087adb1b5e5ae1d9123278e178656186a/VSCodeUserSetup-x64-1.30.1.exe'
                    :'https://vscode.cdn.azure.cn/stable/dea8705087adb1b5e5ae1d9123278e178656186a/VSCodeUserSetup-ia32-1.30.1.exe'
                break;
            case 'mac':
                name='VSCode-darwin-stable.zip';
                openMethod='open '+name
                tempUrl='https://vscode.cdn.azure.cn/stable/dea8705087adb1b5e5ae1d9123278e178656186a/VSCode-darwin-stable.zip'
                break;
        }
        await this.download(tempUrl,name)
        exec(openMethod)//打开文件
        console.log('                                              ------vscode初始化完毕')
    }
    // git 克隆
    gitCloneAddress(){
        let { gitAddresses } = config;
        if(gitAddresses.length>0){
            gitAddresses.forEach(_gitAddress=>{
                exec('git clone '+_gitAddress).then(res=>{
                    console.log(_gitAddress+': 克隆完毕')
                }).catch(rej=>{
                    console.log(_gitAddress+': 克隆失败\n')
                    console.log(rej)
                })
            })
        }else{
            process.stdout.write('> 请输入git项目地址 多个则用英文逗号隔开: \n')
            process.stdout.write('> 记得先安装git,如果git环境变量还没生效,请重开shell再敲一遍webenv init \n')
            process.stdin.once('data',function(data) {
                gitAddresses=data.toString().split(',')
                gitAddresses.forEach(_gitAddress=>{
                    _gitAddress=_gitAddress.trim()
                    exec('git clone '+_gitAddress).then(res=>{
                        console.log(_gitAddress+': 克隆完毕')
                    }).catch(rej=>{
                        console.log(_gitAddress+': 克隆失败\n')
                        console.log(rej)
                    })
                })
                process.stdin.pause()
            })
        }
    }
    // 下载函数
    async download(_url,_name){
        if(!fs.existsSync(_name)){
            //删除临时文件
            fs.existsSync(_name+'.temp')?fs.unlinkSync(_name+'.temp'):''
            let tempHttp=url.parse(_url).protocol==='https:' ?https :http
            // 下载文件
            await new Promise(res=>{
                let req=tempHttp.request(_url,function(_res){
                    let data=new Buffer(0)
                    _res.on('data', d => {
                        fs.appendFileSync(_name+'.temp',d)
                    });
                    _res.on('end',function(){
                        fs.renameSync(_name+'.temp',_name)
                        res()//返回promise
                    })
                })
                req.end();//请求结束
            })
        }
    }
    // 初始化
    init(){
        console.log('当前操作系统是: '+process.arch)
        this.whatPlatform()
        this.setPATH()
        this.downloadCNPM()
        this.downloadYARN()
        // .then(()=>this.downloadModules())
        .then(()=>Promise.all([this.downloadGit(),this.downloadVSC()]))
        .then(()=>{this.gitCloneAddress()})
        // .catch(process.exit(1))
    }
}

var one = new OneKey();
one.init();