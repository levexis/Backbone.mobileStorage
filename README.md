Backbone.mobileStorage
======================

Heavily modified forked of Backbone.dualStorage v1.1.0, written for use with PhoneGap. Works as a drop in replacement for PhongeGap.

Extends dualStorage to work with mobile apps, enable via collection properties. This was designed for use with a Backbone Phonegap app. 

The idea is that it always returns local copies of data to keep app snappy and then does a lazy fetch. You can change this by using returns = local.

Seems that this implementation is similar to what is coming in Angular 2.0 as well, which seems to be gaining traction with the HTML5 native community.
 
Whilst there is decent test coverage we are not using this in production and this should be considered an Alpha / Beta. Check the issues and pull requests for activity and all contributions most welcome. 

##Installation

Use backbone.mobilestorage.js as a drop in replacement for backbone.dualstorage.js

##Implementation

The following properties can be set on a collection:
 
- dualSync = sync online / offline - do both online and offline, enables ®return etc
- remote = fetch remote - remote only ( default behaviour, ignores local cache if dualSync is false
- local = fetch local - local only if remote and dualSync disabled
- returns =  default is remote if remote and online and no dirty data otherwise local
- isOnline = defaults to navigator.onLine but who capitalizes the L in online! Doesn't try to make requests, does same as if error 0

<i>Note isOnline can be passed a function for use with native html5 apps, eg phonegap.</i>

If these collection parameters are not set then will behave like dualStorage. Note the meaning of these parameters may be slightly different to how they wre implemented for dualStorage.

# Development

Use node 0.10.x and type npm install. Tests are in mocha with karma, use npm test.
 
## Thanks

This is based on Backbone.dualStorage which was based on Backbone.localStorage. 

## License

Licensed under MIT license.


