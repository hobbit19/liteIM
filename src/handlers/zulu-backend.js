const request = require('request')

async function handler(endpoint, token, params, currency = 'LTC') {
    let credential, firebaseID
    if (process.env.STAGE === 'production') {
        credential = require('../private/firebase_prod_credentials.json')
        firebaseID = credential.project_id
    } else {
        credential = require('../private/firebase_dev_credentials.json')
        firebaseID = credential.project_id
    }

    let supportedTokens = JSON.parse(process.env.TOKENS)
    let currencies = Object.keys(supportedTokens).map(key => {
        return key.toUpperCase()
    })

    let baseURL = (process.env.STAGE === 'production') ? process.env.PROD_URL : process.env.DEV_URL

    let apiPromise = new Promise((resolve, reject) => {
        request(
            {
                url: baseURL + endpoint,
                headers: {
                    "x-selected-database": firebaseID,
                    "x-selected-currencies": JSON.stringify(currencies),
                    "x-selected-currency": currency.toUpperCase(),
                    Authorization: `Bearer ${token}`
                },
                method: 'POST',
                json: params
            },
            (error, response, body) => {
                if (!error && response.statusCode === 200) {
                    resolve(body)
                }
                else {
                    console.log("Backend Error: ", error)
                    reject(false)
                }
            }
        )
    })

    return await apiPromise

}

const changeEmail = (token, newEmail, currentPassword) => {
    let params = { newEmail, currentPassword }
    return handler('/user/change-email', token, params)
}

const changePassword = (token, currentPassword, newPassword) => {
    let params = { currentPassword, newPassword }
    return handler('/user/change-password', token, params)
}

const createWallet = (currency, token, currentPassword) => {
    let params = { currentPassword, service: 'LiteIM' }
    return handler('/user/wallets', token, params, currency)
}

const revealKey = (currency, token, currentPassword, accountNumber) => {
    let params = {currentPassword, accountNumber}
    return handler('/user/wallets/export', token, params, currency)
}

const send = (currency, token, source, recipient, amount, currentPassword, fee, toEmail = null) => {
    let params = { source, recipient, amount, currentPassword, fee, toEmail }
    return handler('/crypto/transfer', token, params, currency)
}

module.exports = {
    changeEmail, changePassword, createWallet, revealKey, send
}