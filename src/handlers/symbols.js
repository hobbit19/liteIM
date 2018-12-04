module.exports = (token) => {

    let symbol = ''
    if (token.toLowerCase() === 'ltc') {
        symbol = 'Ł'
    }
    else if (token.toLowerCase() === 'eth') {
        symbol = 'Ξ'
    }
    else if (token.toLowerCase() === 'ztx') {
        symbol = 'ZTX'
    }

    return symbol

}