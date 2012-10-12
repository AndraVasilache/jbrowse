define( ['dojo/_base/declare'
        ],
        function( declare ) {


var Feature = declare( null,

/**
 * @lends JBrowse.Store.BAM.Feature
 */
{

    /**
     * Feature object used for the JBrowse BAM backend.
     * @param args.store the BAM store this feature comes from
     * @param args.record optional BAM record (a plain object) containing the data for this feature
     * @constructs
     */
    constructor: function( args ) {
        this.store = args.store;

        var data = args.record ? dojo.clone( args.record ) : args.data;

        // figure out start and end
        data.start = data.start || data.pos;
        data.end = data.end || ( data.lref ? data.pos + data.lref : data.seq ? data.pos + data.seq.length : undefined );

        /*  can extract "SEQ reverse complement" from bitwise flag, 
         *    but that gives orientation of the _read sequence_ relative to the reference, 
         *    whereas feat[STRAND] is intended to indicate orientation of the _template_
         *        (in the case of RNA-Seq, the RNA that the read is derived from) relative to the reference
         *   for some BAM sources (such as TopHat), an optional field "XS" is used to to indicate RNA orientation 
         *        relative to ref.  'XS' values are '+' or '-' (any others?), 
         *        for some sources, lack of 'XS' is meant to indicate plus strand, only minus strand are specifically tagged
         *   for more on strandedness, see seqanswers.com/forums/showthread.php?t=9303
         *   TODO: really need to determine whether to look at bitwise flag, or XS, or something else based 
         *           on the origin of the BAM data (type of sequencer or program name, etc.)
         *           for now using XS based on honeybee BAM data
         */
        // trying to determine orientation from 'XS' optional field
        data.strand = ('XS' in data )                ? ( data.XS == '-' ? -1 : 1 ) :
                       data.seq_reverse_complemented ? -1                          :
                                                       1;

        data.score = data.mapping_quality || data.MQ || data.mq;
        data.type = data.type || 'match';
        data.source = args.store.source;
        data.seq_id = data.segment;
        delete data.segment;

        data.name = data.readName;
        delete data.readName;
        delete data.pos;

        this.data = data;
        this._subCounter = 0;
        this._uniqueID = args.parent ? args.parent._uniqueID + '-' + ++args.parent._subCounter
                                     : this.data.name+' at '+ data.seq_id + ':' + data.start + '..' + data.end;

        var cigar = data.CIGAR || data.cigar;
        this.data.subfeatures = [];
        if( cigar ) {
            this.data.subfeatures.push.apply( this.data.subfeatures, this._cigarToSubfeats( cigar, this ) );
        }
    },

    /**
     *  take a cigar string, and initial position, return an array of subfeatures
     */
    _cigarToSubfeats: function(cigar, parent)    {
        var subfeats = [];
        var lops = cigar.match(/\d+/g);
        var ops = cigar.match(/\D/g);
        // console.log(cigar); console.log(ops); console.log(lops);
        var min = parent.get('start');
        var max;
        for (var i = 0; i < ops.length; i++)  {
            var lop = parseInt(lops[i]);  // operation length
            var op = ops[i];  // operation type
            // converting "=" to "E" to avoid possible problems later with non-alphanumeric type name
            if (op === "=")  { op = "E"; }

            switch (op) {
            case 'M':
            case 'D':
            case 'N':
            case 'E':
            case 'X':
                max = min + lop;
                break;
            case 'I':
                max = min;
                break;
            case 'P':  // not showing padding deletions (possibly change this later -- could treat same as 'I' ?? )
            case 'H':  // not showing hard clipping (since it's unaligned, and offset arg meant to be beginning of aligned part)
            case 'S':  // not showing soft clipping (since it's unaligned, and offset arg meant to be beginning of aligned part)
                break;
                // other possible cases
            }
            var subfeat = new Feature({
                store: this.store,
                data: {
                    type: 'match_part',
                    start: min,
                    end: max,
                    strand: parent.get('strand'),
                    CIGAR_OP: op,
                    CIGAR_LEN: lop
                },
                parent: this
            });
            if (op !== 'N')  {
                subfeats.push(subfeat);
            }
            min = max;
        }
        return subfeats;
    },

    get: function(name) {
        return this.data[ name ];
    },

    tags: function() {
        var t = [];
        var d = this.data;
        for( var k in d ) {
            if( d.hasOwnProperty( k ) )
                t.push( k );
        }
        return t;
    }

});

return Feature;
});
