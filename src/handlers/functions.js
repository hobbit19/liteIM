const firebase = require('firebase-admin')
const apiHandler = require('./zulu-backend')

//region Initialize Firebase
//---------------------------------------------------------------------------------------
let credential, databaseURL
if (process.env.STAGE === 'production') {
    credential = require('../private/firebase_prod_credentials.json')
    databaseURL = process.env.FIREBASE_PROD_URL
} else {
    credential = require('../private/firebase_dev_credentials.json')
    databaseURL = process.env.FIREBASE_DEV_URL
}

firebase.initializeApp({
    credential: firebase.credential.cert(credential),
    databaseURL
})

firebase.firestore().settings({ timestampsInSnapshots: true })
//---------------------------------------------------------------------------------------
//endregion


//region User/Auth
//---------------------------------------------------------------------------------------
const addLiteIMUserData = async (userID, data) => {
    try {
        return await firebase
            .firestore()
            .collection('liteIM')
            .doc(userID)
            .set(data, { merge: true })
    } catch (err) {
        console.log(err)
        throw {
            response: {
                type: 'failure',
                scope: 'generic',
                specification: null
            }
        }
    }
}

const getUserByFirebaseID = async (userID) => {
    try {
        let liteIMUserDoc = await firebase
            .firestore()
            .collection('liteIM')
            .doc(userID)
            .get()

        let user
        if (liteIMUserDoc.exists) {
            user = liteIMUserDoc.data()
            user.id = liteIMUserDoc.id
        }

        return user

    } catch (err) {
        console.log(err)
        return false
    }
}

const getUserByServiceID = async (service, serviceID) => {
    serviceID = serviceID.toString()
    try {
        let result = await firebase
            .firestore()
            .collection('liteIM')
            .where(`services.${service}`, '==', serviceID)
            .get()

        let user
        if (result.size > 0 && result.docs[0].exists) {
            user = result.docs[0].data()
            user.id = result.docs[0].id
        }

        return user

    } catch (err) {
        console.log(err)
        return false
    }
}

const getUserByEmail = async (email) => {

    email = email.toLowerCase()

    try {
        let result = await firebase
            .firestore()
            .collection('liteIM')
            .where('email', '==', email)
            .get()

        let user
        if (result.size > 0 && result.docs[0].exists) {
            user = result.docs[0].data()
            user.id = result.docs[0].id
        }

        return user

    } catch (err) {
        throw {
            response: {
                type: 'failure',
                scope: 'generic',
                specification: null
            }
        }
    }
}

const getUserByPhone = async (phone) => {
    try {
        let number = phone.toString()
        number = number.replace(/\D+/g, '')

        let result = await firebase
            .firestore()
            .collection('two_factor')
            .where('phoneNumber', '==', number)
            .get()

        let user
        if (result.size > 0 && result.docs[0].exists) {
            let userID = result.docs[0].id

            user = await getUserByFirebaseID(userID)
            user.id = userID
        }

        return user

    } catch (err) {
        throw {
            response: {
                type: 'failure',
                scope: 'generic',
                specification: null
            }
        }
    }
}

const getUserByAddress = async (address) => {
    try {
        let walletDoc = await firebase
            .firestore()
            .collection('wallets')
            .doc(address)
            .get()

        let wallet = walletDoc.exists ? walletDoc.data() : null
        if (!wallet) return false

        let userID = wallet.belongsTo
        return getUserByFirebaseID(userID)
    } catch (err) {
        console.log(err)
        throw `There was a problem finding the user by address: ${address}`
    }
}

const getPhoneNumberForUser = async (userID) => {
    return firebase
        .firestore()
        .collection('two_factor')
        .doc(userID)
        .get()
        .then(async doc => {
            if (doc && doc.exists) {
                return doc.data().phoneNumber.toString()
            } else {
                throw {
                    response: {
                        type: 'failure',
                        scope: 'twoFactor',
                        specification: 'notFound'
                    }
                }
            }
        })
}

const getToken = async (email, password) => {
    const request = require('request')

    try {
        const data = {
            email: email,
            password: password,
            returnSecureToken: true
        }

        let key = (process.env.STAGE === 'production') ?
            process.env.FIREBASE_PROD_API_KEY :
            process.env.FIREBASE_DEV_API_KEY

        let tokenPromise = new Promise((resolve, reject) => {
            request({
                    url: `https://www.googleapis.com/identitytoolkit/v3/relyingparty/verifyPassword?key=${key}`,
                    method: 'POST',
                    json: true,
                    body: data
                },
                (error, response, body) => {
                    if (body.idToken) {
                        resolve(body.idToken)
                    } else {
                        reject({
                            response: {
                                type: 'failure',
                                scope: 'password',
                                specification: null
                            }
                        })
                    }
                })
        })

        let token = await tokenPromise

        if (token) {
            return token
        }

    } catch (err) {
        if (err.response) {
            throw err
        } else {
            console.log(err)
            throw {
                response: {
                    type: 'failure',
                    scope: 'generic',
                    specification: null
                }
            }
        }
    }
}

const checkIfEmailExists = async (email) => {
    try {
        await firebase.auth().getUserByEmail(email) //this returns if exists, throws if doesn't
        return true
    } catch (err) {
        if (err.code === 'auth/user-not-found') return false
        else throw {
            response: {
                type: 'failure',
                scope: 'generic',
                specification: null
            }
        }
    }
}

const checkIfPhoneNumberExists = (number) => {
    try {
        number = number.toString()
        number = number.replace(/\D+/g, '')

        return firebase
            .firestore()
            .collection('two_factor')
            .where('phoneNumber', '==', number)
            .limit(1)
            .get()
            .then(snapshot => {
                if (snapshot.size > 0 && snapshot.docs[0].exists) {
                    let twoFactorData = snapshot.docs[0].data()
                    twoFactorData.id = snapshot.docs[0].id
                    return twoFactorData
                } else {
                    return false
                }
            })
            .catch(err => {
                console.log(err)
                throw {
                    response: {
                        type: 'failure',
                        scope: 'generic',
                        specification: null
                    }
                }
            })
    } catch (err) {
        throw err
    }
}

const createPublicUserData = async (userID, email) => {
    email = email.toLowerCase()

    try {
        return firebase
            .firestore()
            .collection('public_user_data')
            .doc(userID)
            .set({
                    email,
                    createdAt: Date.now()
                },
                { merge: true }
            )
    } catch (err) {
        console.log(err)
    }
}

const checkIfUserHasUpgradedWallet = async (blockchain, userID) => {
    try {
        return firebase
            .firestore()
            .collection('wallets')
            .where('belongsTo', '==', userID)
            .where('service', '==', 'LiteIM')
            .where('type', '==', blockchain)
            .get()
            .then(snapshot => {
                if (snapshot.size > 0 && snapshot.docs[0].exists) {
                    return true
                } else {
                    return false
                }
            })
    } catch (err) {
        console.log(err)
        return false
    }
}
//---------------------------------------------------------------------------------------
//endregion


//region Wallet
//---------------------------------------------------------------------------------------
const getWalletByUserID = async (userID, blockchain) => {
    try {
        let result = await firebase
            .firestore()
            .collection('wallets')
            .where('belongsTo', '==', userID)
            .where('service', '==', 'LiteIM')
            .where('type', '==', blockchain)
            .get()

        if (result.size > 0 && result.docs[0].exists) {
            let wallet = result.docs[0].data()
            wallet.id = result.docs[0].id
            return wallet

        } else {
            throw result
        }

    } catch (err) {
        console.log(err)
        throw {
            response: {
                type: 'failure',
                scope: 'generic',
                specification: null
            }
        }
    }
}

const getWalletByEmail = async (email, blockchain) => {
    try {
        let user = await getUserByEmail(email)
        if (!user) return false

        return await getWalletByUserID(user.id, blockchain)
    } catch (err) {
        console.log(err)
        throw {
            response: {
                type: 'failure',
                scope: 'generic',
                specification: null
            }
        }
    }
}

const getWalletByPhoneNumber = async (phone, blockchain) => {
    try {
        let user = await getUserByPhone(phone)
        if (!user) return false
        return await getWalletByUserID(user.id, blockchain)
    } catch (err) {
        console.log(err)
        throw {
            response: {
                type: 'failure',
                scope: 'generic',
                specification: null
            }
        }
    }
}
//---------------------------------------------------------------------------------------
//endregion


//region Two Factor Authentication
//---------------------------------------------------------------------------------------
const enable2FA = async (service, serviceID, number) => {
    serviceID = serviceID.toString()
    try {
        let code = generate2FACode()
        number = number.toString()
        number = number.replace(/\D+/g, '')

        await firebase
            .firestore()
            .collection('two_factor')
            .doc(`${service}_${serviceID}`)
            .set({
                activated: false,
                type: 'sms',
                phoneNumber: number,
                credentialExpires: null,
                onLogin: true,
                onTransaction: false
            })
            .then(() => {
                firebase
                    .firestore()
                    .collection('pending_two_factor')
                    .doc(number)
                    .set({
                        type: 'sms',
                        actionType: 'enable',
                        textMatch: code,
                        belongsTo: serviceID.toString(),
                        phone: number,
                        expiresAt: Date.now() + 120 * 1000
                    })
            })

            if (number.charAt(0) !== '+') {
                number = `+${number}`
            }

            const twilio = require('./twilio-2fa')
            return twilio(
                number,
                `Thank you for using Lite.IM. Your code is: ${code}`
            )

    } catch (err) {
        console.log(err)
        throw {
            response: {
                type: 'failure',
                scope: 'generic',
                specification: null
            }
        }
    }
}

const request2FA = async (userID) => {
    try {
        let code = generate2FACode()
        let phone = await getPhoneNumberForUser(userID)

        let number = phone.replace(/\D+/g, '')

        await firebase
            .firestore()
            .collection('pending_two_factor')
            .doc(number)
            .set({
                type: 'sms',
                actionType: 'enable',
                textMatch: code,
                belongsTo: userID,
                phone: number,
                expiresAt: Date.now() + 120 * 1000
            })
            .catch(err => {
                throw {
                    response: {
                        type: 'failure',
                        scope: 'generic',
                        specification: null
                    }
                }
            })

        if (phone.charAt(0) !== '+') {
            phone = `+${phone}`
        }
        const twilio = require('./twilio-2fa')
        return twilio(
            phone,
            `Here is your Lite.IM security code: ${code}`
        )

    } catch (err) {
        let response
        if (!err.response) {
            response = {
                response: {
                    type: 'failure',
                    scope: 'generic',
                    specification: null
                }
            }
        } else {
            response = err
        }

        throw response
    }
}

const check2FA = async (service, serviceID, code, userID = null) => {
    serviceID = serviceID.toString()
    try {
        let docName = userID ? userID : `${service}_${serviceID}`
        let twoFactorRef = firebase
            .firestore()
            .collection('two_factor')
            .doc(docName)

        let twoFactorDoc = await twoFactorRef
            .get()
            .catch(() => {
                throw {
                    response: {
                        type: 'failure',
                        scope: 'generic',
                        specification: null
                    }
                }
            })

        let twoFactor = twoFactorDoc.exists ? twoFactorDoc.data() : null

        if (!twoFactor) {
            throw {
                response: {
                    type: 'failure',
                    scope: 'twoFactor',
                    specification: 'notEnabled'
                }
            }
        }

        let pendingDoc = await firebase
            .firestore()
            .collection('pending_two_factor')
            .doc(twoFactor.phoneNumber)
            .get()
            .catch(() => {
                throw {
                    response: {
                        type: 'failure',
                        scope: 'generic',
                        specification: null
                    }
                }
            })

        let pending = pendingDoc.exists ? pendingDoc.data() : null

        if (!pending) {
            throw {
                response: {
                    type: 'failure',
                    scope: 'twoFactor',
                    specification: 'noPending'
                }
            }
        }

        //check if code is expired
        if (pending.expiresAt <= Date.now()) {
            throw {
                response: {
                    type: 'failure',
                    scope: 'twoFactor',
                    specification: 'invalid'
                }
            }
        }

        //check if input matches the code that was sent
        if (pending.textMatch !== code.toString()) {
            throw {
                response: {
                    type: 'failure',
                    scope: 'twoFactor',
                    specification: 'invalid'
                }
            }
        }

        let obj = { credentialExpires: Date.now() + 300 * 1000 }
        if (pending.actionType === 'enable') obj.activated = true
        if (pending.actionType === 'disable') obj.activated = false

        //update the two factor doc
        await twoFactorRef
            .set(obj, { merge: true })
            .catch(() => {
                throw {
                    response: {
                        type: 'failure',
                        scope: 'generic',
                        specification: null
                    }
                }
            })

    } catch (err) {
        let response
        if (!err.response) {
            response = {
                response: {
                    type: 'failure',
                    scope: 'generic',
                    specification: null
                }
            }
        } else {
            response = err
        }

        throw response
    }
}

const updateIdOn2FA = async (service, serviceID) => {
    serviceID = serviceID.toString()

    try {
        let getUser = await getUserByServiceID(service, serviceID)

        let firebaseID = getUser.id
        let docName = `${service}_${serviceID}`

        return firebase
            .firestore()
            .collection('two_factor')
            .doc(docName)
            .get()
            .then(doc => {
                if (doc && doc.exists) {

                    let data = doc.data()
                    return firebase
                        .firestore()
                        .collection('two_factor')
                        .doc(firebaseID)
                        .set(data)
                        .then(() => {
                            doc.ref.delete()
                            return true
                        })
                        .catch(err => {
                            console.log(err)
                            throw 'Could not update the ID of the 2FA entry.'
                        })

                } else {
                    throw 'Could not find 2FA for this user.'
                }
            })
            .catch(err => {
                console.log(err)
                throw 'Could not find 2FA for this user.'
            })
    } catch (err) {
        console.log(err)

        let response
        if (!err.response) {
            response = {
                response: {
                    type: 'failure',
                    scope: 'generic',
                    specification: null
                }
            }
        } else {
            response = err
        }

        throw response
    }
}
//---------------------------------------------------------------------------------------
//endregion


//region Command Actions
//---------------------------------------------------------------------------------------
const balance = async (userID, currency, blockchain) => {

    currency = currency.toUpperCase()

    try {
        let walletData = await getWalletByUserID(userID, blockchain)
        return walletData.currencies[currency] || 0

    } catch (err) {
        let response
        if (!err.response) {
            response = {
                response: {
                    type: 'failure',
                    scope: 'generic',
                    specification: null
                }
            }
        } else {
            response = err
        }

        throw response
    }
}

const changeEmail = async (user, newEmail, password) => {

    newEmail = newEmail.toLowerCase()

    try {
        let token = await getToken(user.email, password)
        let apiResponse = await apiHandler.changeEmail(token, newEmail, password)

        if (apiResponse.success) {
            await firebase
                .firestore()
                .collection('liteIM')
                .doc(user.id)
                .set({ email: newEmail }, { merge: true })

            await firebase
                .auth()
                .updateUser(
                    user.id,
                    { email: newEmail }
                )

            return true

        } else {
            throw {
                response: {
                    type: 'failure',
                    scope: 'changeEmail',
                    specification: 'backend'
                }
            }
        }
    } catch (err) {
        let response
        if (!err.response) {
            response = {
                response: {
                    type: 'failure',
                    scope: 'generic',
                    specification: null
                }
            }
        } else {
            response = err
        }

        throw response
    }
}

const changeLanguage = async (user, language) => {
    return firebase
        .firestore()
        .collection('liteIM')
        .doc(user.id)
        .set({ language }, { merge: true })
}

const changePassword = async (user, currentPassword, newPassword) => {
    try {
        let token = await getToken(user.email, currentPassword)


        let apiResponse = await apiHandler
            .changePassword(
                token,
                currentPassword,
                newPassword
            )

        if (apiResponse.success) {
            return firebase.auth().updateUser(user.id, {
                password: newPassword
            })
        } else {
            throw {
                response: {
                    type: 'failure',
                    scope: 'changePassword',
                    specification: 'backend'
                }
            }
        }
    } catch (err) {
        let response
        if (!err.response) {
            response = {
                response: {
                    type: 'failure',
                    scope: 'generic',
                    specification: null
                }
            }
        } else {
            response = err
        }

        throw response
    }
}

const exportWallet = async (user, type, password, currency) => {
    try {
        let token = await getToken(user.email, password)
        let walletData = await getWalletByUserID(user.id, currency)
        let apiResponse = await apiHandler.revealKey(currency, token, password, walletData.accountNumber)
        let { success, data } = apiResponse

        if (!success) {
            throw {
                response: {
                    type: 'failure',
                    scope: 'export',
                    specification: 'backend',
                    context: {type}
                }
            }
        }

        if (type === 'key') {
            return data.privateKey
        } else {
            return data.phrase
        }

    } catch (err) {
        let response
        if (!err.response) {
            response = {
                response: {
                    type: 'failure',
                    scope: 'generic',
                    specification: null
                }
            }
        } else {
            response = err
        }

        throw response
    }
}

const receive = async (user, blockchain) => {
    try {
        let walletData = await getWalletByUserID(user.id, blockchain)
        let wallet = walletData.address
        let email = user.email

        return { wallet, email }
    } catch (err) {
        let response
        if (!err.response) {
            response = {
                success: false,
                response: {
                    type: 'failure',
                    scope: 'generic',
                    specification: null
                }
            }
        } else {
            response = err
        }

        throw response
    }
}

const send = async (currency, blockchain, to, amount, password, user) => {
    try {
        let toWallet, toEmail, toUser
        const validationHandler = require('./validation')
        if (validationHandler.isEmail(to)) {
            let toWalletData = await getWalletByEmail(to, blockchain)
            if (!toWalletData) {
                throw {
                    response: {
                        type: 'failure',
                        scope: 'send',
                        specification: 'notRegistered',
                        context: {entry: to}
                    }
                }
            }
            toUser = await getUserByEmail(to)
            toWallet = toWalletData.id
            toEmail = to

        }

        else if (validationHandler.isPhoneNumber(to)) {
            let toWalletData = await getWalletByPhoneNumber(to, blockchain)
            if (!toWalletData) {
                throw {
                    response: {
                        type: 'failure',
                        scope: 'send',
                        specification: 'notRegistered',
                        context: {entry: to}
                    }
                }
            }
            toWallet = toWalletData.id
            toUser = await getUserByFirebaseID(toWalletData.belongsTo)
            toEmail = toUser.email
        }

        else if (validationHandler.isCryptoAddress(blockchain, to)) {
            toWallet = to
            let checkIfRegistered = await getUserByAddress(to)

            if (checkIfRegistered) {
                toUser = checkIfRegistered
                toEmail = checkIfRegistered.email
            }
        }

        else {
            throw {
                response: {
                    type: 'failure',
                    scope: 'send',
                    specification: 'invalidAddress',
                    context: { currency: currency.toUpperCase() }
                }
            }
        }

        let fromWalletData = await getWalletByUserID(user.id, blockchain)
        let from = fromWalletData.accountNumber
        let token = await getToken(user.email, password)

        let fee
        if (blockchain === 'ETH') {
            fee = 21
        } else if (blockchain === 'LTC') {
            fee = 110
        }

        let apiResponse = await apiHandler.send(
            currency,
            token,
            from,
            toWallet,
            amount,
            password,
            fee,
            toEmail
        )

        let { success, data } = apiResponse

        if (success) {
            return { txid: data.txid, toUser }
        }
        else {
            if (data.code && (data.code === 'NO_UTXOS' || data.code === 'INPUT_OUTPUT')) {
                throw {
                    response: {
                        type: 'failure',
                        scope: 'send',
                        specification: 'noUTXOs'
                    }
                }
            }
            else if (data.code && data.code === 'INSUFFICIENT_FUNDS') {
                throw {
                    response: {
                        type: 'failure',
                        scope: 'send',
                        specification: 'gas'
                    }
                }
            }
            else if (data.code && data.code === '2FA_AUTH_REQUIRED') {
                throw {
                    response: {
                        type: 'failure',
                        scope: 'twoFactor',
                        specification: 'authRequired'
                    }
                }
            }
            else throw {
                response: {
                    type: 'failure',
                    scope: 'send',
                    specification: 'transaction'
                }
            }
        }
    } catch (err) {
        let response
        if (!err.response) {
            response = {
                response: {
                    type: 'failure',
                    scope: 'generic',
                    specification: null
                }
            }
        } else {
            response = err
        }

        throw response
    }
}

const signup = async (service, serviceID, language, email, password) => {

    serviceID = serviceID.toString()
    let didCreatePublcUserData = false
    let didCreateFirebaseUser = false
    let didCreateLiteIMUser = false
    let didCreateWallet = false
    let userID = ''

    try {
        if (await getUserByServiceID(service, serviceID)) {
            throw {
                response: {
                    type: 'failure',
                    scope: 'alreadyRegistered',
                    specification: null
                }
            }
        }

        else if (await checkIfEmailExists(email)) {
            throw {
                response: {
                    type: 'failure',
                    scope: 'alreadyRegistered',
                    specification: null
                }
            }
        }

        else {
            let user = await firebase.auth().createUser({ email, password })

            userID = user.uid
            didCreateFirebaseUser = true

            let token = await getToken(email, password)

            let supportedTokens = JSON.parse(process.env.TOKENS)
            let currencies = Object.keys(supportedTokens).map(key => {
                return key.toUpperCase()
            })

            let data = {
                email,
                language,
                services: {
                    [service]: serviceID
                },
                supportedTokens: currencies
            }

            await addLiteIMUserData(userID, data)
            didCreateLiteIMUser = true

            //remove LTC from the list, as we will create that first to ensure the account has one master seed
            let index = currencies.indexOf('LTC')
            if (index !== -1) currencies.splice(index, 1)

            let createdAddresses = []
            let backendResponse = await apiHandler.createWallet('LTC', token, password)
            if (backendResponse.success) {
                didCreateWallet = true
                let addressData = backendResponse.data
                createdAddresses.push(addressData)

            } else throw {
                response: {
                    type: 'failure',
                    scope: 'signup',
                    specification: 'backend'
                }
            }

            //remove ZTX from the array, since it doesn't need its own wallet, just an ETH wallet
            index = currencies.indexOf('ZTX')
            if (index !== -1) currencies.splice(index, 1)

            let promises = []
            currencies.forEach(async currency => {
                promises.push(apiHandler.createWallet(currency, token, password))
            })

            let results = await Promise.all(promises)

            results.forEach(backendResponse => {
                if (backendResponse.success) {
                    didCreateWallet = true
                    let addressData = backendResponse.data

                    createdAddresses.push(addressData)
                } else throw {
                    response: {
                        type: 'failure',
                        scope: 'signup',
                        specification: 'backend'
                    }
                }
            })

            if (createdAddresses.length > 0) didCreateWallet = true

            let addresses = ''
            createdAddresses.forEach(data => {
                addresses += `${data.type}: ${data.address}\n`
            })

            await createPublicUserData(userID, email)
            didCreatePublcUserData = true

            return addresses
        }
    } catch (err) {

        //rollback created items
        let promises = []
        if (didCreateFirebaseUser) {
            promises.push(firebase.auth().deleteUser(userID))
        }

        if (didCreateLiteIMUser) {
            promises.push(
                firebase
                    .firestore()
                    .collection('liteIM')
                    .doc(userID)
                    .delete()
            )
        }

        if (didCreateWallet) {
            promises.push(
                firebase
                    .firestore()
                    .collection('liteIM')
                    .where('belongsTo', '==', userID)
                    .get()
                    .then(snapshot => {
                        snapshot.forEach(async doc => {
                            if (doc && doc.exists) {
                                await doc.delete()
                            }
                        })
                    })
            )
        }

        if (didCreatePublcUserData) {
            firebase
                .firestore()
                .collection('public_user_data')
                .doc(userID)
                .delete()
        }

        promises.push(
            firebase
                .firestore()
                .collection('two_factor')
                .doc(`${service}_${serviceID}`)
                .delete()
        )

        await Promise.all(promises)

        //throw response
        let response
        if (!err.response) {
            response = {
                response: {
                    type: 'failure',
                    scope: 'generic',
                    specification: null
                }
            }
        } else {
            response = err
        }

        throw response
    }
}

const transactions = async (service, serviceID, userID, token, blockchain, symbol, limit, startTime, startID) => {
    serviceID = serviceID.toString()
    try {
        let walletData = await getWalletByUserID(userID, blockchain)
        let address = walletData.address

        let query = firebase
            .firestore()
            .collection('transactions')
            .where('_parties', 'array-contains', address)
            .where('_type', '==', token.toUpperCase())
            .orderBy('_createdAt', 'desc')
            .orderBy('_hash', 'asc')
            .limit(limit + 1)

        if (startTime && startID) query = query.startAt(startTime, startID)

        let transactions = await query
            .get()
            .then(snapshot => {
                let txs = []
                if (snapshot.size <= 0) return txs
                snapshot.forEach(transaction => {
                    if (transaction.exists) {
                        let tx = transaction.data()
                        txs.push(tx)
                    }
                })

                return txs
            })

        if (transactions.length === 0) {
            return { transactions, more: false }
        }

        let slice
        let more = false
        if (transactions.length > limit) {
            more = true
            slice = limit
            let nextTime = transactions[limit]._createdAt
            let nextID = transactions[limit]._hash

            await updateConversation(service, serviceID, { startTime: nextTime, startID: nextID })

        } else {
            slice = transactions.length
        }

        let i
        let txData = []
        for (i = 0; i < slice; i++) {

            let direction = '⬅️'
            if (transactions[i]._sender === address) {
                direction = '➡️'
            }

            //TODO: handle regional dates based on language preference
            let date = new Date(transactions[i]._createdAt)
                .toLocaleDateString(
                    "en-US",
                    { year: '2-digit', month: 'numeric', day: 'numeric' }
                )

            let amount = +Number(transactions[i]._amount).toFixed(3)

            let url = getBlockExplorerURL(blockchain, transactions[i]._hash)

            txData.push({
                txid: transactions[i]._hash,
                date,
                direction,
                amount,
                url,
                _transaction: transactions[i],
                symbol
            })
        }

        return { transactions: txData, more }

    } catch (err) {
        let response
        if (!err.response) {
            response = {
                response: {
                    type: 'failure',
                    scope: 'generic',
                    specification: null
                }
            }
        } else {
            response = err
        }

        throw response
    }
}

const addBlockchain = async (blockchain, user, password) => {
    let token = await getToken(user.email, password)
    let backendResponse = await apiHandler.createWallet(blockchain, token, password)

    if (backendResponse.success) {
        return backendResponse.data.address
    } else throw {
        response: {
            type: 'failure',
            scope: 'signup',
            specification: 'backend'
        }
    }
}

//---------------------------------------------------------------------------------------
//endregion


//region Conversations
//---------------------------------------------------------------------------------------
const getConversation = async (service, serviceID) => {
    serviceID = serviceID.toString()
    try {
        return firebase
            .firestore()
            .collection('liteIM')
            .doc('state')
            .collection(`${service}_conversations`)
            .doc(serviceID)
            .get()
            .then(doc => {
                if (doc && doc.exists) {
                    return doc.data()
                } else {
                    return false
                }

            })
    } catch (err) {
        console.log(err)
        throw {
            response: {
                type: 'failure',
                scope: 'generic',
                specification: null
            }
        }
    }
}

const createConversation = async (service, serviceID, command) => {
    serviceID = serviceID.toString()
    try {
        return firebase
            .firestore()
            .collection('liteIM')
            .doc('state')
            .collection(`${service}_conversations`)
            .doc(serviceID)
            .set({ command })
    } catch (err) {
        console.log(err)
        throw {
            response: {
                type: 'failure',
                scope: 'generic',
                specification: null
            }
        }
    }
}

const updateConversation = async (service, serviceID, data, command = null) => {
    serviceID = serviceID.toString()

    let values = { values: data }

    if (command) {
        values.command = command
    }

    try {
        return firebase
            .firestore()
            .collection('liteIM')
            .doc('state')
            .collection(`${service}_conversations`)
            .doc(serviceID)
            .set(values, { merge: true })
    } catch (err) {
        console.log(err)
        throw {
            response: {
                type: 'failure',
                scope: 'generic',
                specification: null
            }
        }
    }
}

const clearConversation = async (service, serviceID) => {
    serviceID = serviceID.toString()
    try {
        return firebase
            .firestore()
            .collection('liteIM')
            .doc('state')
            .collection(`${service}_conversations`)
            .doc(serviceID)
            .delete()
    } catch (err) {
        console.log(err)
    }
}
//---------------------------------------------------------------------------------------
//endregion


//region Ongoing Messages
//---------------------------------------------------------------------------------------
const getBotMessageID = async (service, serviceID) => {
    serviceID = serviceID.toString()
    try {
        return firebase
            .firestore()
            .collection('liteIM')
            .doc('state')
            .collection(`${service}_ongoingMessages`)
            .doc(serviceID)
            .get()
            .then(snapshot => {
                if (snapshot.exists) {
                    return snapshot.data()
                } else {
                    console.log(`Could not get the ongoing conversation for ${serviceID}.`)
                    return false
                }
            })
            .catch(err => {
                console.log(`Could not get the ongoing conversation for ${serviceID}.`)
                return false
            })
    } catch (err) {
        console.log(err)
    }
}

const setBotMessageID = async (service, serviceID, messageID) => {
    serviceID = serviceID.toString()
    try {
        return firebase
            .firestore()
            .collection('liteIM')
            .doc('state')
            .collection(`${service}_ongoingMessages`)
            .doc(serviceID)
            .set({ messageID }, { merge: true })
            .catch(err => {
                throw `Could not set the ongoing conversation for this user.`
            })
    } catch (err) {
        console.log(err)
    }
}
//---------------------------------------------------------------------------------------
//endregion


//region Menu-Based
//---------------------------------------------------------------------------------------
const setLastMenu = (service, serviceID, menu) => {
    serviceID = serviceID.toString()
    return firebase
        .firestore()
        .collection('liteIM')
        .doc('state')
        .collection(`${service}_cachedMenus`)
        .doc(serviceID)
        .set({ menu })
}

const getLastMenu = async (service, serviceID) => {
    serviceID = serviceID.toString()
    return firebase
        .firestore()
        .collection('liteIM')
        .doc('state')
        .collection(`${service}_cachedMenus`)
        .doc(serviceID)
        .get()
        .then(doc => {
            if (!doc.exists) return null
            return doc.data().menu
        })
        .catch(err => {
            console.error('error getting last menu:', err)
            return null
        })
}
//---------------------------------------------------------------------------------------
//endregion


//region Misc
//---------------------------------------------------------------------------------------
const getRate = async (token) => {

    token = token.toLowerCase()
    try {
        if (token === 'ztx') {
            return await fetch('https://www.cryptopia.co.nz/api/GetMarket/ZTX_BTC')
                .then(async data => {
                    let priceInBTC = parseFloat(data.Data.LastPrice)
                    if (priceInBTC) {
                        return await fetch('https://www.bitstamp.net/api/v2/ticker/btcusd')
                            .then(data => {
                                let btcRate = parseFloat(data.last)
                                return priceInBTC * btcRate
                            })
                    }
                })
        }

        else {
            return await fetch(`https://www.bitstamp.net/api/v2/ticker/${token}usd`)
                .then(data => {
                    return parseFloat(data.last)
                })
        }

    } catch (err) {
        throw {
            response: {
                type: 'failure',
                scope: 'getPrice',
                specification: null
            }
        }
    }
}

const getBlockExplorerURL = (blockchain, txid) => {

    let url
    blockchain = blockchain.toUpperCase()
    if (blockchain === 'LTC') {
        let subdomain =
            process.env.STAGE === 'production' || process.env.STAGE === 'staging'
                ? 'insight'
                : 'testnet'
        url = `https://${subdomain}.litecore.io/tx/${txid}/`
    } else if (blockchain === 'ETH') {

        let subdomain =
            process.env.STAGE === 'production' || process.env.STAGE === 'staging'
                ? 'www'
                : 'rinkeby'

        url = `https://${subdomain}.etherscan.io/tx/${txid}`
    }

    return url

}

const getAllUsersSnapshot = async () => {
    return firebase
        .firestore()
        .collection('liteIM')
        .get()
        .then(snapshot => {
            return snapshot
        })
}
//---------------------------------------------------------------------------------------
//endregion


//region Helpers
//---------------------------------------------------------------------------------------
function generate2FACode() {
    let code = []
    for (let i = 0; i < 6; i++) {
        code.push(Math.round(Math.random() * 9))
    }
    return code.join('')
}

async function getNextTransactionID(userID) {
    try {
        return firebase
            .firestore()
            .collection('liteIM')
            .doc(userID)
            .get()
            .then(doc => {
                if (doc && doc.exists) {
                    let nextTime = doc.data()._nextTime
                    let nextID = doc.data()._nextTransactionID

                    return { nextTime, nextID }
                } else {
                    return false
                }
            })
    } catch (err) {
        console.log(err)
    }
}

async function setNextTransactionID(userID, nextTime, nextID) {
    try {
        return firebase
            .firestore()
            .collection('liteIM')
            .doc(userID)
            .set({
                    _nextTime: nextTime,
                    _nextTransactionID: nextID
                },
                { merge: true }
            )
    } catch (err) {
        console.log(err)
    }
}

async function unsetNextTransactionID(userID) {
    try {
        let FieldValue = require('firebase-admin').firestore.FieldValue
        return firebase
            .firestore()
            .collection('liteIM')
            .doc(userID)
            .set({
                    _nextTime: FieldValue.delete(),
                    _nextTransactionID: FieldValue.delete()
                },
                { merge: true }
            )
    } catch (err) {
        console.log(err)
    }
}

function fetch(url) {
    const request = require('request')
    return new Promise((resolve, reject) => {
        request(
            {
                url,
                method: 'GET'
            },
            (error, response, body) => {
                if (!error && response.statusCode === 200) {
                    resolve(JSON.parse(body))
                } else {
                    reject(false)
                }
            }
        )
    })
}
//---------------------------------------------------------------------------------------
//endregion

module.exports = {
    addLiteIMUserData, getUserByFirebaseID, getUserByServiceID, getUserByEmail, getUserByPhone, getUserByAddress,
    getPhoneNumberForUser, getToken, checkIfEmailExists, checkIfPhoneNumberExists, checkIfUserHasUpgradedWallet,
    addBlockchain, enable2FA, request2FA, check2FA, updateIdOn2FA, balance, changeEmail, changeLanguage, changePassword,
    exportWallet, receive, send, signup, transactions, getConversation, createConversation, updateConversation,
    clearConversation, getBotMessageID, setBotMessageID, getLastMenu, setLastMenu, getRate, getBlockExplorerURL,
    getAllUsersSnapshot
}