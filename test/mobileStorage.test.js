/**
 * Tests of more advanced / edge case dualStorage cases for connectid in lazy dualSync mode.
 */

// dualSync = sync online / offline - do both online and offline, enables ®return etc
// remote = fetch remote - remote only ( default behaviour, ignores local cache if dualSync is false
// local = fetch local - local only if remote and dualSync disabled
// returns =  default is remote if remote and online and no dirty data otherwise local
// isOnline = defaults to navigator.onLine but who the fuck capitalizes the L in online! Doesn't try to make requests, does same as if error 0
define( [ 'dualStorage' , 'jquery' , 'underscore' ] ,  function ( Backbone , $ , _  ) {
    // identifies a dualStorage generated key rather than a mongodb generated one
    function isClientKey ( id ) {
        return (!!id && id.length === 36 && id.match(/-/g).length === 4);
    }

    /**
     * checks doc._id for backbone id using isClientKey
     * @param {object} doc
     * @returns {boolean} true if a local record not yet synced
     */
    function isDirty ( doc ) {
        return !doc._id || isClientKey ( doc._id );
    }
    var expect = chai.expect,
        should = chai.should(),
        TestModel,
        TestCollection,
        aList = [ { name: 'Adam', date: new Date() },
            { name: 'Bertie', date: new Date() },
            { name: 'Chris', date: new Date() }
        ],
        dList = [ { name: 'Dan', date: new Date() },
            { name: 'Eric', date: new Date() },
            { name: 'Fred', date: new Date() }
        ],
        gList = [ { name: 'Geoff', date: new Date() },
            { name: 'Henry', date: new Date() },
            { name: 'Ian', date: new Date() }
        ];

    describe('test ConnectiD dualStorage', function() {
        var coll,
            _id = 1,//Math.pow( 10 , 32 ),
            remoteColl = _.union( aList, dList );

        function _resetIds() {
            _id = 1;
            function reset ( obj ) {
                delete obj._id;
            }
            aList.forEach ( reset );
            dList.forEach ( reset );
            gList.forEach ( reset );
        }
        /**
         * creates a new document for stubbed out collection
         * @param doc {object} doc to create, will add an _id if remote create set
         * @param callBack {function}
         * @private
         */
        function _createDoc ( doc , callBack ) {
            // success CB is called when local only so make sure we don't CB twice
            var isLocal = false,
                created;
            // clearout the call stack so getCall 0 is last all
            created = coll.create ( doc , { success: function () {
                isLocal = true; // rename cbCalled perhaps
                if ( typeof callBack === 'function' ) callBack ( doc );
            },
                error: function() {
                    isLocal = true; // rename cbCalled perhaps
                    if ( typeof callBack === 'function' ) callBack ();
                }
            });
            // add the _id to the original object as we can then compare deeply to fetched
            doc._id = _id++;
            // if jerryHallId is set that is because there are syncing requests to resolve first
            if ( !isLocal && !created.validationError && $.ajax.called && !created.jerryHallId) $.ajax.getCall( $.ajax.callCount-1 ).args[0].success( doc );
            return created;
            // give it a "proper" id, ie no hyphens like you get from mongo
//            if ( !isLocal) $.ajax.getCall(0).args[0].success( _.extend ( doc , {_id : _id++ } ) );
        }
        /**
         * fetches stubbed collection, pass in remote collection.
         * @param remoteCollection {array}
         * @param callBack {function}
         * @private
         */
        function _fetch ( remoteCollection , callBack ) {
            // success CB is called when local only so make sure we don't CB twice
            var isLocal = false;
            // clearout the call stack so getCall 0 is last all
            $.ajax.reset();
            coll.fetch (  { success: function () {
                isLocal = true; // rename cbCalled perhaps
                if ( typeof callBack === 'function' ) callBack ( remoteCollection );
            } } );
            // give it a "proper" id, ie no hyphens like you get from mongo and prevent double callback
            if ( !isLocal) $.ajax.getCall(0).args[0].success( remoteCollection );
        }

        before ( function () {
            TestModel = Backbone.Model.extend({
                idAttribute: '_id',
                validate: function(attrs, options) {
                    if ( _.has(attrs,'name') ) {
                        var name = attrs.name.toLowerCase();
                        return ( !name ||
                            name === 'jon' ||
                            name === 'shaun' ||
                            name === 'ian'  );
                    }
                    return null;
                }
            });
            TestCollection = Backbone.Collection.extend({
                local: true, // maintain local copy
                remote:  true,// maintain remote copy
                dualSync : true,// sync local and remote copies
                model : TestModel,
                return : 'local',
                isOnline : true,
                url : '/api/1/tests', // doesnt exist
                comparator: function( doc ) {
                    return doc.get('name');
                },
                initialize: function() {
                    this.on('change', this.sort);
                }
            });
        });
        describe('Clean locally synced collections, remote changed', function() {
            beforeEach ( function() {
                _resetIds();
                window.localStorage.clear();
                coll = new TestCollection();
                coll.remote = true;
                coll.local = true;
                coll.dualSync = true;
                sinon.stub( $ , 'ajax');
                aList.forEach ( _createDoc );
                coll.length.should.equal(3);
                $.ajax.reset();
            });
            afterEach ( function() {
                $.ajax.restore();
            });
            describe('when online' , function() {
                beforeEach ( function() {
                    coll.isOnline = true;
                });
                it('should return local version if returns = local or not defined' , function () {
                    coll.returns = 'local';
                    _fetch( remoteColl );
                    coll.length.should.equal(3);
                });
                it('should fetch & return remote version if returns = remote' , function ( done ) {
                    coll.returns = 'remote';
                    _fetch( remoteColl , function () {
                        coll.length.should.equal(6);
                        done();
                    });
                });
                it('should return remote if nothing stored locally, regardless of returns', function(done) {
                    window.localStorage.clear();
                    coll.returns = 'local';
                    _fetch( aList , function () {
                        coll.length.should.equal(3);
                        done();
                    });
                });
                it('should sort alphabetically', function(done) {
                    gList.forEach ( _createDoc );
                    dList.forEach ( _createDoc );
                    coll.fetch( _.union( gList , dList ) );
                    coll.toJSON().pop().name.should.equal('Henry');
                    done();
                });
                it('should delete and return reduced records', function(done) {
                    var model = coll.get( aList[0]._id );
                    model.destroy();
                    $.ajax.should.have.been.calledOnce;
                    coll.length.should.equal( 2 );
                    $.ajax.getCall(0 ).args[0].success();
                    coll.length.should.equal( 2 );
                    done();
                });
                it('should update and return sorted updated records', function(done) {
                    var model = coll.get( aList[0]._id );
                    model.set( { name: 'Zoe' } );
                    model.save();
                    $.ajax.should.have.been.calledOnce;
                    coll.length.should.equal( 3 );
                    coll.toJSON()[0].name.should.equal( aList[1].name );
                    $.ajax.getCall(0 ).args[0].success();
                    coll.length.should.equal( 3 );
                    coll.toJSON()[2].name.should.equal('Zoe');
                    done();
                });
            });
            describe('when offline' , function() {
                beforeEach ( function() {
                    coll.isOnline = false;
                });
                it('should ignore returns = remote', function () {
                    coll.returns = 'remote';
                    _fetch( remoteColl );
                    coll.length.should.equal(3);
                });
                it('should add records locally' , function () {
                    _createDoc ( gList[0] );
                    $.ajax.should.not.have.been.called;
                    _fetch( remoteColl );
                    $.ajax.should.not.have.been.called;
                    coll.length.should.equal(4);
                    expect ( isDirty ( coll.toJSON().pop() ) ).to.be.true;
                });
                it('should support isOnline as a function' , function () {
                    coll.isOnline = function () { return false };
                    _fetch( remoteColl );
                    coll.length.should.equal(3);
                });
                it('should sort alphabetically', function(done) {
                    gList.forEach ( _createDoc );
                    dList.forEach ( _createDoc );
                    coll.fetch( _.union( gList , dList ) );
                    coll.toJSON().pop().name.should.equal('Henry');
                    done();
                });
                it('should delete and return reduced records', function(done) {
                    var model = coll.get( aList[0]._id );
                    model.destroy();
                    $.ajax.should.not.have.been.called;
                    coll.length.should.equal( 2 );
                    done();
                });
            });
        });
        describe('Empty locally synced collections', function() {
            beforeEach ( function() {
                _resetIds();
                window.localStorage.clear();
                coll = new TestCollection();
                sinon.stub( $ , 'ajax');
            });
            afterEach ( function() {
                Backbone.mobileStorage.stoppedSyncing();
                $.ajax.restore();
            });
            describe('when online' , function() {
                beforeEach ( function() {
                    coll.isOnline = true;
                });
                it('should fetch and return remote even if returns = local' , function ( done ) {
                    coll.returns = 'local';
                    _fetch( aList  , function () {
                        coll.length.should.equal(3);
                        $.ajax.should.have.been.calledOnce;
                        done();
                    });
                });
                it('should not make a localStorage copy if dualSync not enabled for collection (default Backbone Behaviour)', function ( done ) {
                    coll.dualSync = false;
                    coll.local = false;
                    _fetch( aList  , function () {
                        window.localStorage.length.should.equal( 0 );
                        $.ajax.should.have.been.called;
                        done();
                    });
                });
            });
            describe('when offline' , function() {
                beforeEach ( function() {
                    coll.isOnline = false;
                });
                it('should still not make a localStorage copy if dualSync not enabled for collection (default Backbone Behaviour)', function () {
                    coll.dualSync = false;
                    coll.local = false;
                    _fetch( remoteColl );
                    window.localStorage.length.should.equal( 0 );
                    $.ajax.should.have.been.called;
                });
                it('should create and return a new blank local collection regardless of return', function() {
                    coll.returns = 'remote';
                    _fetch( remoteColl );
                    coll.length.should.equal( 0 );
                });
                it('should not attempt to make remote calls if local or dualSync option set' , function () {
                    _fetch( remoteColl );
                    $.ajax.should.not.have.been.called;
                });
                it('should attempt to make remote calls if dualSync not enabled for collection (default Backbone)' , function () {
                    coll.dualSync = false;
                    coll.local = false;
                    _fetch( remoteColl );
                    $.ajax.should.have.been.called;
                });
                it('should create locally' , function () {
                    _createDoc( gList[0] );
                    coll.length.should.equal( 1 );
                    window.localStorage.length.should.not.equal( 0 );
                });
                it('should validate on local create and reject if validation fails' , function () {
                    _createDoc({ name: 'Jon' }).validationError.should.be.true;
                    window.localStorage.length.should.equal( 0 );
                    _fetch();
                    coll.length.should.equal( 0 );
                });
                it('should create and delete locally', function(done) {
                    aList.forEach ( _createDoc );
                    var model = coll.findWhere( { name: aList[0].name } );
                    model.destroy();
                    $.ajax.should.not.have.been.called;
                    coll.length.should.equal( 2 );
                    done();
                });
                it('should update and return sorted ', function(done) {
                    aList.forEach ( _createDoc );
                    var model = coll.findWhere( { name: aList[0].name } );
                    model.set( { name: 'Zoe' } );
                    model.save();
                    $.ajax.should.not.have.been.called;
                    coll.length.should.equal( 3 );
                    coll.toJSON()[0].name.should.equal( aList[1].name );
                    done();
                });

            });
        });
        describe('Dirty locally synced collections', function() {
            describe('when online' , function() {
                var promises;
                function _resolvePromise ( promise  ) {
                    // we get array pos as 2nd argument so just resolve!
                    promise.resolve();
                }
                beforeEach ( function( done ) {
                    promises = [];
                    _resetIds();
                    function makePromise () {
                        var deferred = new $.Deferred(),
                            i = promises.length;
                        promises.push ( deferred );
                        return deferred.promise();
                    }
                    window.localStorage.clear();
                    coll = new TestCollection();
                    coll.dualSync = true;
                    coll.local = true;
                    coll.remote = true;
                    coll.isOnline = true;
                    sinon.stub( $ , 'ajax' , makePromise);
                    aList.forEach ( _createDoc );
                    coll.length.should.equal(3);
                    // now put offline
                    coll.isOnline = false;
                    dList.forEach ( _createDoc );
                    coll.length.should.equal(6);
                    promises = [];
                    $.ajax.reset();
                    coll.isOnline = true;
                    done();
                });
                afterEach ( function( done ) {
                    $.ajax.restore();
                    Backbone.mobileStorage.stoppedSyncing();
                    done();
                });
                it('should sync dirty records after next read online', function (done) {
                    var _dirtyCount = 0,
                        remote = _.union ( aList,dList);
                    function checkDirty ( doc ) {
                        if ( isDirty( doc ) ) {
                            _dirtyCount ++;
                            return true;
                        } else {
                            return false;
                        }
                    }
                    _fetch ( _.union ( aList,dList) );
                    coll.length.should.equal(6);
                    coll.toJSON().forEach ( checkDirty );
                    expect( _dirtyCount ).to.equal(3);
                    $.ajax.callCount.should.equal(3);
                    $.ajax.getCall(0).args[0].success();
                    $.ajax.getCall(1).args[0].success();
                    $.ajax.getCall(2).args[0].success();
                    // once promises resolve it will fetch the remote collection, could offer a flag if API always returns collection to avoid extra round trip
                    promises.length.should.equal ( 3 );
                    promises.forEach ( _resolvePromise );
                    $.ajax.callCount.should.equal(4);
                    $.ajax.getCall(3).args[0].success( remote );
                    _dirtyCount = 0;
                    _fetch ( _.union ( aList,dList) );
                    coll.toJSON().forEach ( checkDirty );
                    expect( _dirtyCount ).to.equal( 0 );
                    done();
                });
                // actually why should it wait, this test now fails as we now create locally so return straight away
                it.skip('should sync dirty records before next create online' , function ( done ) {
                    _createDoc( gList[0] , function () {
                        $.ajax.getCall(3).args[0].type.should.equal('POST');
                        $.ajax.getCall(3).args[0].url.should.equal('/api/1/tests');
                        coll.length.should.equal ( 7 );
                        done();
                    });
                    coll.length.should.equal(7);
                    // put client key in callback? how do we test?
                    $.ajax.getCall(0).args[0].success( dList[0] );
                    $.ajax.getCall(1).args[0].success( dList[1] );
                    $.ajax.getCall(2).args[0].success( dList[2] );
                    promises.forEach ( _resolvePromise )
                    $.ajax.callCount.should.equal ( 4 );
                    $.ajax.getCall(3).args[0].success( gList[0] );
                });
                it('should sync dirty records before next update online' , function ( done ) {
                    var rec = coll.get ( 1 );
                    rec.set ( { updated : true } );
                    rec.save();
                    $.ajax.callCount.should.equal ( 3 );
                    promises.forEach ( _resolvePromise );
                    $.ajax.getCall(3).args[0].type.should.equal('PUT');
                    $.ajax.getCall(3).args[0].url.should.equal('/api/1/tests/1');
                    done();
                });
                it('should sync dirty records before next delete online' , function (done) {
                    var rec = coll.get(1);
                    rec.destroy ( rec );
                    $.ajax.callCount.should.equal ( 3 );
                    promises.forEach ( _resolvePromise );
                    $.ajax.getCall(3).args[0].type.should.equal('DELETE');
//                    $.ajax.getCall(3).args[0].url.should.equal('/api/1/tests');
                    $.ajax.callCount.should.equal ( 4 );
                    coll.length.should.equal ( 5 );
                    done();
                });
                it('should not create or update a remote record if delete queued', function (done) {
                    var rec = coll.findWhere ( { name : dList[0].name } );
                    rec.destroy ( rec );
                    promises.forEach ( _resolvePromise );
                    $.ajax.callCount.should.equal ( 2 );
                    coll.length.should.equal ( 5 );
                    done();
                });
                it('should return remote results from local cache on double fetch' , function (done) {
                    var _dirtyCount = 0, result, remote =  _.union( aList , dList );
                    function checkDirty ( doc ) {
                        if ( isDirty( doc ) ) {
                            _dirtyCount ++;
                            return true;
                        } else {
                            return false;
                        }
                    }
                    _fetch( _.union( aList , dList ) );
                    // return dirty
                    result = coll.toJSON();
                    result.forEach ( checkDirty );
                    expect( _dirtyCount ).to.equal(3);
                    $.ajax.getCall(0).args[0].success();
                    $.ajax.getCall(1).args[0].success();
                    $.ajax.getCall(2).args[0].success();
                    promises.forEach ( _resolvePromise );
                    Backbone.mobileStorage.isSyncing().should.be.false;
                    $.ajax.getCall(3).args[0].success( remote );
                    // should now return clean
                    _dirtyCount = 0;
                    _fetch( _.union( aList , dList ) );
                    result = coll.toJSON();
                    result.forEach ( checkDirty );
                    expect( _dirtyCount ).to.equal(0);
//                    expect(result).to.have.members( remote ); dates are formatted differently
                    done();
                });
                it('should return dirty results on second fetch if queue not yet played back', function (done) {
                    var _dirtyCount = 0, result = [], remote =  _.union( aList , dList );
                    function checkDirty ( doc ) {
                        if ( isDirty( doc ) ) {
                            _dirtyCount ++;
                            return true;
                        } else {
                            return false;
                        }
                    }
                    _fetch( remote );
                    // return dirty
                    result = coll.toJSON();
                    result.forEach ( checkDirty );
                    Backbone.mobileStorage.isSyncing().should.be.ok;
                    $.ajax.callCount.should.equal( 3 );
                    $.ajax.getCall(0).args[0].success( dList[0] );
                    $.ajax.getCall(1).args[0].success( dList[1] );
//                    $.ajax.getCall(3).args[0].success();
                    // should not create extra call to fetch clean
                    // should now return clean
                    _dirtyCount = 0;
                    _fetch( remote  );
                    result = coll.toJSON();
                    result.forEach ( checkDirty );
                    expect( _dirtyCount ).to.equal(1);
                    coll.length.should.equal (6);
//                    expect(result).to.have.members( remote ); dates are formatted differently
                    done();
                });
                it('should behave the same if a new collection is created from local copy', function (done) {
                    var _dirtyCount = 0, result = [], remote =  _.union( aList , dList );
                    function checkDirty ( doc ) {
                        if ( isDirty( doc ) ) {
                            _dirtyCount ++;
                            return true;
                        } else {
                            return false;
                        }
                    }
                    coll = new TestCollection();
                    coll.dualSync = true;
                    coll.local = true;
                    coll.remote = true;
                    coll.isOnline = true;
                    _fetch( remote );
                    // return dirty
                    result = coll.toJSON();
                    result.forEach ( checkDirty );
                    Backbone.mobileStorage.isSyncing().should.be.ok;
                    $.ajax.callCount.should.equal( 3 );
                    $.ajax.getCall(0).args[0].success( dList[0] );
                    $.ajax.getCall(1).args[0].success( dList[1] );
//                    $.ajax.getCall(3).args[0].success();
                    // should not create extra call to fetch clean
                    // should now return clean
                    _dirtyCount = 0;
                    _fetch( remote  );
                    result = coll.toJSON();
                    result.forEach ( checkDirty );
                    expect( _dirtyCount ).to.equal(1);
                    coll.length.should.equal (6);
//                    expect(result).to.have.members( remote ); dates are formatted differently
                    done();
                });

                it('should have fully refreshed collection after queue played back',function () {
                    var _dirtyCount = 0;
                    function checkDirty ( doc ) {
                        if ( isDirty( doc ) ) {
                            _dirtyCount ++;
                            return true;
                        } else {
                            return false;
                        }
                    }
                    coll.syncDirtyAndDestroyed();
                    $.ajax.getCall(0).args[0].success( dList[0] );
                    $.ajax.getCall(1).args[0].success( dList[1] );
                    $.ajax.getCall(2).args[0].success( dList[2] );
                    coll.fetch ( { dirtyLoad: true } );
                    coll.toJSON().forEach ( checkDirty );
                    _dirtyCount.should.equal(0);
                });
                it('should not lose or duplicate records from queue if connectivity fails', function( done ) {
                    var _dirtyCount = 0;
                    function checkDirty ( doc ) {
                        if ( isDirty( doc ) ) {
                            _dirtyCount ++;
                            return true;
                        } else {
                            return false;
                        }
                    }
                    coll.syncDirtyAndDestroyed();
                    $.ajax.getCall(0).args[0].success( dList[0] );
                    $.ajax.getCall(1).args[0].error( dList[1] );
                    $.ajax.getCall(2).args[0].error( dList[2] );
                    coll.fetch ( { fetchLocal: true } );
                    coll.toJSON().forEach ( checkDirty );
                    _dirtyCount.should.equal(2);
                    coll.length.should.equal(6);
                    // should now sync successfully
                    coll.syncDirtyAndDestroyed();
                    $.ajax.getCall(3).args[0].success( dList[1] );
                    $.ajax.getCall(4).args[0].success( dList[2] );
                    coll.length.should.equal(6);
                    _dirtyCount = 0;
                    coll.toJSON().forEach ( checkDirty );
                    _dirtyCount.should.equal(0);
                    expect ( window.localStorage.getItem('sync error' ) ).to.not.exist;
                    done();
                });
                it('should put all other CUD errors in error collection for debugging' , function ( done ) {
                    coll.syncDirtyAndDestroyed();
                    $.ajax.getCall(0).args[0].error({ status : '409', message : 'test' });
                    $.ajax.getCall(1).args[0].error({ status : '409', message : 'test' });
                    $.ajax.getCall(2).args[0].error({ status : '409', message : 'test' });
                    JSON.parse( window.localStorage.getItem('sync error' ) ).length.should.equal(3);
                    done();
                });
                it('should delete synced and unsynced records', function(done) {
                    var modelA = coll.get( aList[0]._id ),
                        modelB = coll.get( aList[1]._id ),
                        modelD = coll.findWhere( { name : dList[0].name }),
                        _dirtyCount = 0;
                    function checkDirty ( doc ) {
                        if ( isDirty( doc ) ) {
                            _dirtyCount ++;
                            return true;
                        } else {
                            return false;
                        }
                    };
                    modelA.destroy();
                    coll.length.should.equal( 5 )
                    modelD.destroy();
                    coll.length.should.equal( 4 );
                    modelB.destroy();
                    coll.length.should.equal( 3 );
                    $.ajax.should.have.been.calledThrice;
                    $.ajax.getCall(0).args[0].success( dList[0] );
                    $.ajax.getCall(1).args[0].success( dList[1] );
                    $.ajax.getCall(2).args[0].success( dList[2] );
                    promises.forEach ( _resolvePromise );
                    $.ajax.callCount.should.equal(5);
                    coll.syncDestroyed(); // this should be automated after syncing for immediate deletes?
                    coll.length.should.equal( 3 );
                    $.ajax.callCount.should.equal( 6 );
                    $.ajax.getCall(3 ).args[0].success();
                    $.ajax.getCall(4 ).args[0].success();
                    $.ajax.getCall(5 ).args[0].success();
                    coll.length.should.equal( 3 );
                    coll.fetch();
                    coll.toJSON().forEach ( checkDirty );
                    _dirtyCount.should.equal(0);
                    // check local storage in sync
                    localStorage.length.should.equal(4);
                    done();
                });
                it('should update and return sorted updated records and update after sync', function(done) {
                    var modelA = coll.get( aList[0]._id ),
                        modelD = coll.findWhere( { name : dList[0].name } ),
                        modelE = coll.findWhere( { name : dList[1].name } ),
                        _dirtyCount = 0;
                    function checkDirty ( doc ) {
                        if ( isDirty( doc ) ) {
                            _dirtyCount ++;
                            return true;
                        } else {
                            return false;
                        }
                    }
                    // dirty
                    modelE.set( 'name', 'Barry' );
                    modelE.save();
                    // clean
                    modelA.set( 'name' , 'Zoe' );
                    modelA.save();
                    //dirty
                    modelD.set( 'name',  'Andy' );
                    modelD.save();
                    // should have updated Eric to Barry and then synced Dan, Barry, Fred
                    $.ajax.should.have.been.calledThrice;
                    coll.length.should.equal( 6 );
                    coll.toJSON()[5].name.should.equal( 'Zoe' );
                    // now sync dirty
                    $.ajax.getCall(0).args[0].success( {_id : dList[0]._id });
                    $.ajax.getCall(1).args[0].success( {_id : dList[1]._id });
                    $.ajax.getCall(2).args[0].success( {_id : dList[2]._id });
                    // then it should
                    promises.forEach ( _resolvePromise );
                    $.ajax.callCount.should.equal(4);
                    $.ajax.getCall(3).args[0].success(  {_id : dList[1]._id });
                    $.ajax.getCall(3 ).args[0].type.should.equal ('PUT');
                    coll.toJSON()[5].name.should.equal( 'Zoe' );
                    coll.toJSON()[0].name.should.equal( 'Andy' );
                    _dirtyCount = 0;
                    coll.toJSON().forEach ( checkDirty );
                    _dirtyCount.should.equal(0);
                    done();
                });

            });
            describe('when offline' , function() {
                beforeEach ( function() {
                    _resetIds();
                    window.localStorage.clear();
                    coll = new TestCollection();
                    coll.isOnline = true;
                    sinon.stub( $ , 'ajax');
                    aList.forEach ( _createDoc );
                    coll.length.should.equal(3);
                    // localSync called on success or error, otherwise localstorage is not populated and fetch fails
                    $.ajax.getCall(0).args[0].success();
                    $.ajax.getCall(1).args[0].error();
                    $.ajax.getCall(2).args[0].success();
                    // now put offline
                    coll.isOnline = false;
                    dList.forEach ( _createDoc );
                    coll.length.should.equal(6);
                    $.ajax.reset();
                });
                afterEach ( function() {
                    $.ajax.restore();
                });
                it('should continue to create and return local records' , function () {
                    _createDoc( gList[0] );
                    _fetch();
                    coll.length.should.equal( 7 );
                    $.ajax.should.not.have.been.called;
                });
                it('should update records from collection fetched' , function () {
                    var doc = coll.get ( 1 );
                    doc.set( 'updated', true  );
                    doc.save();
                    $.ajax.should.not.have.been.called;
                    coll.get( 1 ).get( 'updated' ).should.equal( true );
                });
                it('should remove deleted records from collection fetched', function() {
                    var doc = coll.get ( 1 );
                    doc.destroy();
                    $.ajax.should.not.have.been.called;
                    coll.length.should.equal( 5 );
                });
            });
        });
        describe('helper methods and unit level probing', function() {
            var promises;
            function _resolvePromise ( promise  ) {
                // we get array pos as 2nd argument so just resolve!
                promise.resolve();
            }
            beforeEach ( function( done ) {
                promises = [];
                _resetIds();
                function makePromise () {
                    var deferred = new $.Deferred();
                    promises.push ( deferred );
                    return deferred.promise();
                }
                window.localStorage.clear();
                coll = new TestCollection();
                coll.isOnline = true;
                sinon.stub( $ , 'ajax' , makePromise);
                aList.forEach ( _createDoc );
                coll.length.should.equal(3);
                // now put offline
                coll.isOnline = false;
                dList.forEach ( _createDoc );
                coll.length.should.equal(6);
                promises = [];
                $.ajax.reset();
                coll.isOnline = true;
                done();
            });
            afterEach ( function() {
                $.ajax.restore();
                Backbone.mobileStorage.stoppedSyncing();
            });
            it('should support direct call to syncDirtyAndDestroyed', function () {
                coll.syncDirtyAndDestroyed();
                $.ajax.getCall(0).args[0].success();
                $.ajax.getCall(1).args[0].success();
                $.ajax.getCall(2).args[0].success();
                coll.fetch ( { fetchLocal: true } );
                coll.length.should.equal(6);
            });
            it('should sync records in order they were created', function () {
                coll.syncDirtyAndDestroyed();
                $.ajax.getCall(0).args[0].data.should.contain( dList[0].name );
                $.ajax.getCall(1).args[0].data.should.contain( dList[1].name );
                $.ajax.getCall(2).args[0].data.should.contain( dList[2].name );
            });
            // not implemented - will not start a new dirty sync if old one not completed could check new dirty records added whilst syncing
            it('should wait for one sync request to complete before starting another' , function () {
                coll.syncDirtyAndDestroyed();
                _createDoc ( gList[0] );
                _createDoc ( gList[1] );
                // should now have 5 dirty records 3 of which are syncing
            });
            it('should do requests asynchronously so app can continue to be used working with offline data'); // can only do this with an e2e test to check UI is responsive
            it('should wait for syncing to complete before executing next remote fetch', function () {
                _fetch ( _.union ( aList , dList ) );
                $.ajax.callCount.should.equal ( 3 );
                promises.forEach ( _resolvePromise );
                $.ajax.callCount.should.equal ( 4 );
                $.ajax.getCall(3).args[0].type.should.equal ('GET');
            });
        });
    });
});