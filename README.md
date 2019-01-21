<img src="https://raw.githubusercontent.com/zulurepublic/liteIM/master/liteIM.png" alt="LiteIM" width="250"/>

## 1. What is Lite.IM?

Lite.IM is a full-featured, conversational cryptocurrency wallet built for use with SMS and instant messaging apps. Users can signup and create their wallet, send and receive cryptocurrency, and check their balance and transaction history, all with a simple set of commands.

Currently, Lite.IM supports Telegram, Facebook Messenger, as well as SMS messaging for U.S. and Canadian phone numbers, with additional app and country support coming soon. Cryptocurrencies currently supported are BTC, LTC, ETH, and ZTX.

Lite.IM is a project from the [Zulu Republic](https://www.zulurepublic.io/) team. 

## 2. Technology

**Architecture**

Lite.IM is lightweight, yet robust. Lite.IM is built to be scalable, highly available, and most importantly, secure. We are using industry leading services to assure the highest level of quality and peace of mind. 

**Private Keys**

Security is at the forefront of our services. Users' private keys are RSA encrypted using the user's password. Only the encrypted value is stored, which can only be decrypted using the user's password. We do not store passwords of any sort, authentication tokens of any sort, nor do we ever store an unencrypted version of a user's sensitive data, so users' funds are secure even if our servers are compromised. 

## 3. Platforms In Production

- Facebook: ([Lite.IM](https://m.me/Lite.IM))
- Telegram: ([@LiteIM_bot](https://telegram.me/LiteIM_bot))
- Zalo: ([Lite.IM](https://zalo.me/162072345184879763))
- SMS: 
    - US/CAN: +1-760-LITEIM-0 (+1-760-548-3460)

## 4. How does it work?

User onboarding takes place directly within the bot's chat environment. Users are prompted to register with an email address and password, and to enable two-factor authentication with a mobile phone number. Upon successful registration and confirmation of the received 2FA code, the user's wallet is ready to use. 

By following simple prompts from the bot, users can then send and receive cryptocurrency, reveal their balance, and view their recent transaction history. 

When using the send command, users can send cryptocurrency to either a valid wallet address or to an email address if the recipient is already registered with Lite.IM. 

The receive command allows users to reveal their wallet address and/or the email address that they registered with. 

Additional functionality will be added with future updates. 

## 5. Licensing 

Lite.IM is licensed under the [GNU Affero General Public License](https://www.gnu.org/licenses/agpl-3.0.en.html) (AGPL-3.0-only) license. This means you are free to share or adapt it in any way, but not for commercial use.

## 6. Contribute

Please submit pull requests for big fixes and improvements. If you have any questions, please feel free to contact us on any of our community channels. Please make sure your code is working before submitting a pull request. If you have a feature request, please use the [issues page](https://github.com/zulurepublic/liteIM/issues) and tag your issue with "feature-request".

## 7. Bug Reporting

Bug reports can be sent to support@zulurepublic.io or submitted via chat at the [Zulu Republic Support Page](http://support.zulurepublic.io/).

You can also reach the dev team directly on [github](https://github.com/zulurepublic/liteIM/issues).

## 8. Learn More

To learn more about Lite.IM, visit the [project website](https://www.lite.im/), as well as the [Zulu Republic website](https://www.zulurepublic.io/) and [blog](www.medium.com/zulurepublic).

The Zulu Republic Telegram community can be found [here](https://t.me/zulurepublicagora).

Follow Lite.IM on Twitter at [@liteim_official](www.twitter.com/liteim_official) and Zulu Republic at [@ztxrepublic](www.twitter.com/ztxrepublic).

## 9. What's New In This Version

- Add support for BTC
- Spanish translations
- Add support for ZTX and ETH
- Implement secure webview for exporting private key data
- Link accounts by phone number during onboarding on a new platform
- Complete multilingual support including menu options
- Vietnamese translations
- Language selection conversations
- Better transactions details instead of presenting only the transaction hash
- Dyamic menus to allow for easier implementation on new platforms
- Implement support for Zalo
- Refined codebase that is easier for maintenance and development
