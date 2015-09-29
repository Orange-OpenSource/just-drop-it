/**
 * Created by Arnaud on 24/09/15.
 */
function WhatsNewHandler(version,whatsNewLink,whatsNewBadge) {
    this.init(version,whatsNewLink,whatsNewBadge);
}

WhatsNewHandler.prototype = {

    constructor: WhatsNewHandler,

    init: function (version,whatsNewLink,whatsNewBadge) {

        this.whatsNewLink = whatsNewLink;
        this.whatsNewBadge = whatsNewBadge;

        //check if new version to reset flag
        if (localStorage.version != version) {
            localStorage.version = version;
            localStorage.removeItem('whatsNewHasBeenRead');
        }

        this._updateLinkAccordingToState();

    },

    _updateLinkAccordingToState: function(){
        if(localStorage.whatsNewHasBeenRead){
            this.whatsNewBadge.hide();
        }else{
            this.whatsNewBadge.show();
        }
    },

    setAsRead: function () {
        localStorage.whatsNewHasBeenRead = true;
        this._updateLinkAccordingToState();
    }
}