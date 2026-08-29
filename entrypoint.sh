#!/bin/bash

mkdir -p /var/run/sshd
useradd -s /bin/bash -d /usr/local/frostybot-js $SSH_USER
adduser $SSH_USER sudo
echo $SSH_USER:$SSH_PASS | chpasswd
echo "$SSH_USER ALL=(ALL) NOPASSWD: ALL" >> /etc/sudoers
cp /root/.profile /usr/local/frostybot-js/.profile
chown $SSH_USER /usr/local/frostybot-js/.profile
echo "PS1='\${debian_chroot:+(\$debian_chroot)}\[\033[01;32m\]\u@frostybot\[\033[00m\]:\[\033[01;34m\]\w\[\033[00m\]\\$ '" > /usr/local/frostybot-js/.bashrc
echo "PS1='\${debian_chroot:+(\$debian_chroot)}\[\033[01;32m\]\u@frostybot\[\033[00m\]:\[\033[01;34m\]\w\[\033[00m\]\\$ '" >> /root/.bashrc
chown $SSH_USER /usr/local/frostybot-js/.bashrc
sed -i "/.*Port .*/cPort $SSH_PORT" /etc/ssh/sshd_config
echo $FROSTYBOT_PORT > /usr/local/frostybot-js/.port
cp -f /usr/local/frostybot-js/scripts/motd /etc/motd  > /dev/null 2>&1

service ssh start
frostybot start

# Fresh installs ship with GUI disabled — enable on first boot if requested
if [ "${GUI_AUTO_ENABLE:-true}" = "true" ]; then
  GUI_EMAIL="${GUI_EMAIL:-admin@localhost}"
  GUI_PASSWORD="${GUI_PASSWORD:-frostybot123}"
  frostybot "gui:enable email=${GUI_EMAIL} password=${GUI_PASSWORD}" >/dev/null 2>&1 || true
fi

# Docker host traffic arrives as bridge gateway IP — whitelist it for webhooks/API
frostybot "whitelist:add ip=172.17.0.1 description=docker-host" >/dev/null 2>&1 || true
frostybot "whitelist:add ip=127.0.0.1 description=localhost" >/dev/null 2>&1 || true

cat /etc/motd
tail -f ./log/frostybot.log
