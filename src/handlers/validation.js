const isCode = (code) => {
    let numeric = Number(code)
    return (!isNaN(numeric) && code.toString().length === 6)
}

const isEmail = (email) => {
    let re = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/
    return re.test(String(email))
}

const isPhoneNumber = (phone) => {
    const { parseNumber } = require('libphonenumber-js')
    let parsed = parseNumber(phone)
    return Object.keys(parsed).length
}

const isCryptoAddress = (token, address) => {
    token = token.toLowerCase()
    if (token === 'ltc') {
        let litecore = require('litecore-lib')
        return litecore.Address.isValid(address)
    }
    else if (token === 'eth' || token === 'ztx') {
        const web3 = require('web3')
        return web3.utils.isAddress(address)
    }
    else {
        return false
    }

}

const isSupportedToken = (token) => {
    const tokens = JSON.parse(process.env.TOKENS)
    return !!tokens[token.toLowerCase()]
}

module.exports = {
    isCode, isEmail, isPhoneNumber, isCryptoAddress, isSupportedToken
}