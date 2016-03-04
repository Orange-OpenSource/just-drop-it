/*
 * just-drop-it
 * Copyright (C) 2016 Orange
 * Authors: Benjamin Einaudi  benjamin.einaudi@orange.com
 *          Arnaud Ruffin arnaud.ruffin@orange.com
 *
 * This program is free software; you can redistribute it and/or
 * modify it under the terms of the GNU General Public License
 * as published by the Free Software Foundation; either version 2
 * of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Foobar.  If not, see <http://www.gnu.org/licenses/>.
 */

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