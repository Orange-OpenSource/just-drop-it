#!/bin/bash
## THIS IS THE MAIN SCRIPT.
## Launch it manually if you want other than daily or montly stats
## Example
## (don't forget to change local first)
##      SEARCH_DATE=$(date -d '2 days ago' '+%-d %b %Y')
##      ./generate-stat-for-date.sh "$SEARCH_DATE"
##
echo "Generating stats for $1"

LOG_DIR=$OPENSHIFT_LOG_DIR 
MAIL_HOST=$MAIL_SMTP_RELAY_HOST 
MAIL_PORT=$MAIL_SMTP_RELAY_PORT

MAIL_FROM="stat_$OPENSHIFT_APP_NAME@orange.com"
MAIL_TO="arnaud.ruffin@orange.com"

LOG_FILE=$LOG_DIR"/nodejs.log"

SEARCH_DATE=$1
#SEARCH_DATE=$(date -d 'yesterday' '+%-d %b %Y')
#SEARCH_DATE="08 Jun 2015"
#date -d 'yesterday' date -d '30 days ago'
#Mon Jun  8 15:31:30 CEST 2015
OPTION=$2

#nombre de transferts =
nb_transfer=$(cat  $LOG_FILE | grep "$SEARCH_DATE" | grep "Expose stream for receiver" | wc -l)

#nombre de personne ayant ouvert la page = 
nb_sender=$(cat $LOG_FILE| grep "$SEARCH_DATE" | grep " New sender" | wc -l)

#nombre de personne ayant tenté IE = 
nb_ie=$(cat $LOG_FILE| grep "$SEARCH_DATE" | grep "serving no ie" | wc -l)

if [ $nb_transfer -gt 0 ]
then
    nb_echec=$(cat $LOG_FILE | grep "$SEARCH_DATE" | grep "notifying receiver that sender left" | wc -l)
    echo "nb_echec=$nb_echec"
    taux_echec=$(echo "scale=2; $nb_echec/$nb_transfer" | bc)

    total_data=$(cat  $LOG_FILE | grep "$SEARCH_DATE" | grep "Expose stream for receiver" | cut -d"=" -f3 | awk '{s+=$1} END {print s}')
    echo "total_data=$total_data"
    total_data_in_mo=$(echo "scale=3; $total_data/(1024*1024)" | bc)
fi

echo "-------------------------------------------"
echo " Statistics $OPENSHIFT_APP_NAME for $SEARCH_DATE"
echo "-------------------------------------------"
echo "Transfers:      $nb_transfer"
if [ $nb_transfer -gt 0 ]
then
	echo "Failure rate:   $taux_echec"
	echo "Total data:     $total_data_in_mo Mo"
fi
echo ""
echo "connections:    $nb_sender"
echo "nb ie tries:    $nb_ie"
echo "-------------------------------------------"


# error handling
function err_exit { echo -e 1>&2; exit 1; }

# create message
function mail_input { 
    echo "ehlo orange.com"
    echo "MAIL FROM: <$MAIL_FROM>"
    echo "RCPT TO: <$MAIL_TO>"
    echo "DATA"
    echo "From: <$MAIL_FROM>"
    echo "To: <$MAIL_TO>"
    echo "MIME-Version: 1.0 "
    echo 'Content-Type:multipart/mixed;boundary="KkK170891tpbkKk__FV_KKKkkkjjwq"'
    echo "Subject: [$OPENSHIFT_APP_NAME] Statistics for $SEARCH_DATE"

    echo '--KkK170891tpbkKk__FV_KKKkkkjjwq'
    echo ""
    echo "-------------------------------------------"
    echo " Statistics $OPENSHIFT_APP_NAME for $SEARCH_DATE"
    echo "-------------------------------------------"
    echo "Transfers:      $nb_transfer"
    if [ $nb_transfer -gt 0 ]
	then
		echo "Failure rate:   $taux_echec"
		echo "Total data:     $total_data_in_mo Mo"
	fi
    echo ""
    echo "connections:    $nb_sender"
    echo "nb ie tries:    $nb_ie"
    echo "-------------------------------------------"

    echo '--KkK170891tpbkKk__FV_KKKkkkjjwq'
    echo 'Content-Type:application/octet-stream;name="log.log" '
    echo 'Content-Transfer-Encoding:base64 '
    echo 'Content-Disposition:attachment;filename="log.log"'

    echo ''
    cat  $LOG_FILE | grep "$SEARCH_DATE" | base64

    echo "--KkK170891tpbkKk__FV_KKKkkkjjwq--"


    echo ""
    echo "."
    echo "quit"
}
if [ -n "$MAIL_HOST" -a -n "$MAIL_PORT" -a "$OPTION" != "-no_send" ]
then
	mail_input | nc $MAIL_HOST $MAIL_PORT || err_exit
fi
