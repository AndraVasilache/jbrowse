define( [ 'dojo/_base/declare',
          'dojo/_base/lang',
          'dojo/_base/array',
          'dojo/_base/json',
          'JBrowse/Util',
          'JBrowse/Digest/Crc32',
          'JBrowse/ConfigAdaptor/AdaptorUtil'
        ], function( declare, lang, array, json, Util, digest, AdaptorUtil ) {

var dojof = Util.dojof;

return declare('JBrowse.ConfigAdaptor.JB_json_v1',null,

    /**
     * @lends JBrowse.ConfigAdaptor.JB_json_v1.prototype
     */
    {

        /**
         * Configuration adaptor for JBrowse JSON version 1 configuration
         * files (formerly known as trackList.json files).
         * @constructs
         */
        constructor: function() {},

        /**
         * Load the configuration file from a URL.
         *
         * @param args.config.url {String} URL for fetching the config file.
         * @param args.onSuccess {Function} callback for a successful config fetch
         * @param args.onFailure {Function} optional callback for a
         *   config fetch failure
         * @param args.context {Object} optional context in which to
         *   call the callbacks, defaults to the config object itself
         */
        load: function( /**Object*/ args ) {
            var that = this;
            if( args.config.url ) {
                var url = Util.resolveUrl( args.baseUrl || window.location.href, args.config.url );
                var handleError = function(e) {
                    e.url = url;
                    if( args.onFailure )
                        args.onFailure.call( args.context || this, e );
                };
                dojo.xhrGet({
                                url: url,
                                handleAs: 'text',
                                load: function( o ) {
                                    try {
                                        o = that.parse_conf( o, args ) || {};
                                        o.sourceUrl = url;
                                        o = that.regularize_conf( o, args );
                                        args.onSuccess.call( args.context || that, o );
                                    } catch(e) {
                                        handleError(e);
                                    }
                                },
                                error: handleError
                            });
            }
            else if( args.config.data ) {
                var conf = this.regularize_conf( args.config.data, args );
                args.onSuccess.call( args.context || this, conf );
            }
        },

        /**
         * In this adaptor, just evals the conf text to parse the JSON, but
         * other conf adaptors might want to inherit and override this.
         * @param {String} conf_text the configuration text
         * @param {Object} load_args the arguments that were passed to <code>load()</code>
         * @returns {Object} the parsed JSON
         */
        parse_conf: function( conf_text, load_args ) {
            return json.fromJson( conf_text );
        },

        /**
         * Applies defaults and any other necessary tweaks to the loaded JSON
         * configuration.  Called by <code>load()</code> on the JSON
         * configuration before it calls the <code>onSuccess</code> callback.
         * @param {Object} o the object containing the configuration, which it
         *                   modifies in-place
         * @param {Object} load_args the arguments that were passed to <code>load()</code>
         * @returns the same object it was passed
         */
        regularize_conf: function( o, load_args ) {
            var sourceUrl = o.sourceUrl || load_args.config.url;
            delete o.sourceUrl;
            delete o.formatVersion;

            o.baseUrl   = o.baseUrl || Util.resolveUrl( sourceUrl, '.' );
            if( o.baseUrl.length && ! /\/$/.test( o.baseUrl ) )
                o.baseUrl += "/";

            // set a default baseUrl in each of the track and store confs, and the names conf, if needed
            if( o.baseUrl ) {
                var addBase =
                    []
                    .concat( o.tracks || [] )
                    .concat( dojof.values(o.stores||{}) ) ;

                if( o.names )
                    addBase.push( o.names );
                array.forEach( addBase, function(t) {
                    if( ! t.baseUrl )
                        t.baseUrl = o.baseUrl || '/';
                },this);
            }

            o = AdaptorUtil.evalHooks( o );

            o = this._regularizeTrackConfigs( o );

            return o;
        },

        _regularizeTrackConfigs: function( conf ) {
            conf.stores = conf.stores || {};

            array.forEach( conf.tracks || [], function( trackConfig ) {

                // if there is a `config` subpart,
                // just copy its keys in to the
                // top-level config
                if( trackConfig.config ) {
                    var c = trackConfig.config;
                    delete trackConfig.config;
                    for( var prop in c ) {
                        if( !(prop in trackConfig) && c.hasOwnProperty(prop) ) {
                            trackConfig[prop] = c[prop];
                        }
                    }
                }

                if( ! trackConfig.store )
                    trackConfig.store = 'default';

                if( ! trackConfig.type )
                    trackConfig.type = 'JBrowse/View/Track/CanvasFeatures';

            }, this);

            return conf;
        }
});
});