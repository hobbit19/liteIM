require('dotenv').config()
const functionHandler = require('./handlers/functions')
const Express = require('express')
const express = Express()
const helmet = require('helmet')
const bodyParser = require('body-parser')
const cors = require('cors')

express.use(cors())
express.use(helmet())
express.use(bodyParser.json())
express.use(bodyParser.urlencoded({ extended: false }))

//facebook app challenge
express.get(process.env.BASE_PATH + '/:service/webhook/', function(req, res, next) {
    if (req.params.service === 'messenger') {
        if (req.query['hub.verify_token'] === process.env.FACEBOOK_MESSENGER_VERIFY) {
            return res.send(req.query['hub.challenge'])
        }
        res.send('wrong token')
    } else {
        next()
    }
})

//webhook
express.post(process.env.BASE_PATH + '/:service/webhook', async (req, res) => {

    let service = req.params.service
    let serviceHandler = await require(`./handlers/services/${service}`)
    let serviceData = await serviceHandler.initialize(req, service)

    if (serviceData) {
        let { commandData, responseData } = await require('./handlers/commands')(serviceData)
        let { message, menu } = await require('./handlers/responses')(serviceData, commandData, responseData)

        if (responseData.notifier) {
            let { user, sender, txid, amount, token } = responseData.notifier
            await require('./handlers/transaction-notification')({ user, sender, txid, amount, token })
        }

        let responsePayload = await serviceHandler.prepareResponse(message, menu, serviceData, responseData)
        let result = await serviceHandler.send(responsePayload)
    }

    res.status(200)
    return res.send({ success: true })

})


//secure password
express.post('/liteIM/password', async (req, res, next) => {
    const { service, serviceID, email, isUser, password, newPassword } = req.body

    if (isUser === 'true') {
        try {
            await functionHandler.getToken(email, password)
        } catch (err) {
            //invalid password

            let languageStrings
            if (user && user.language) {
                languageStrings = require(`../languages/${user.language}.json`)
            } else {
                languageStrings = require('../languages/en.json')
            }

            let error = languageStrings['menuSupport']['failure']['password']
                || 'You have entered an incorrect password. Please try again.'
            return res.send({ success: false, error })
        }
    }

    const input = newPassword ? `${password} ${newPassword}` : password

    const serviceHandler = require(`./handlers/services/${service}`)
    const options = serviceHandler.options

    let serviceData = { service, serviceID, message: input, options }
    let { commandData, responseData } = await require('./handlers/commands')(serviceData)
    let { message, menu } = await require('./handlers/responses')(serviceData, commandData, responseData)
    let responsePayload = await serviceHandler.prepareResponse(message, menu, serviceData, responseData)
    let result = await serviceHandler.send(responsePayload)

    let redirect
    if (service === 'messenger') {
        redirect = 'https://www.messenger.com/closeWindow/?image_url=https%3A%2F%2Fwww.lite.im%2Fstatic%2Ficons%2FIcon-1024.png&display_text=Redirecting%20you%20to%20Messenger'
    }
    else if (service === 'telegram') {
        redirect = 'https://t.me/liteIM_bot'
    }

    let response = redirect ? { success: true, redirect } : { success: true }

    res.status(200)
    return res.send(response)

})


//secure private key
express.post('/liteIM/get-key', async (req, res, next) => {
    let { email, password, type, currency } = req.body

    if (!currency) currency = 'LTC'

    res.status(200)

    try {
        let user = await functionHandler.getUserByEmail(email)
        let secret = await functionHandler.exportWallet(user, type, password, currency)

        let response
        if (secret) {
            response = {
                success: true,
                data: secret
            }
        } else {
            response = {
                success: false
            }
        }
        return res.send(response)
    } catch (err) {
        //invalid password

        let languageStrings
        if (user && user.language) {
            languageStrings = require(`../languages/${user.language}.json`)
        } else {
            languageStrings = require('../languages/en.json')
        }

        let error = languageStrings['menuSupport']['failure']['password']
            || 'You have entered an incorrect password. Please try again.'
        return res.send({ success: false, error })
    }

})


//out-of-network transaction sync notifications
express.post(process.env.BASE_PATH + '/notifier', async (req, res) => {

    const { address, sender, amount, txid } = req.body

    let data
    let notifierResult = false
    try {

        let user = await functionHandler.getUserByAddress(address)
        data = { user, sender, txid, amount }

        notifierResult = await require('./handlers/transaction-notification')(data)
    } catch (e) {
        console.log(e)
    }

    res.status(200)
    res.send(notifierResult)
})


//broadcast message to all users
express.post(process.env.BASE_PATH + '/broadcast', async (req, res) => {

    try {
        await require('./handlers/broadcast')(req.body)
    } catch (e) {
        console.log(e)
    }

    res.send({ success: true })
})


//server
let port = process.env.port || 3001
express.listen(port, err => {
    if (err) return console.error('ERROR:', err)
    console.log('Server is listening on port ', port)
})
