require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const request = require('request');
const Promise = require('bluebird');
const rp = require('request-promise');
const http = require('http');
const util = require('util');
const randomColor = require('randomcolor');
const app = express();

const urlencodedParser = bodyParser.urlencoded();

function convertTextToArgs(text) {
  return text.split(' ').filter((item) => !!item.length)
    .reduce((object, item) => {
      var args = item.split(':');
      object[args[0]] = args[1].split(',');
      return object;
    }, {});
}

function fetchMembersFromChannel(channelId) {
  return rp({
    uri: 'https://slack.com/api/channels.info',
    method: 'GET',
    json: true,
    qs: {
      token: process.env.OAUTH_TOKEN,
      channel: channelId
    }
  }).then((body) => {
    if (body.ok) {
      return body.channel.members;
    } else {
      throw new Error(body.error);
    }
  });
}

function fetchUserDetails() {
  return rp({
    uri: 'https://slack.com/api/users.list',
    method: 'GET',
    json: true,
    qs: {
      token: process.env.OAUTH_TOKEN
    }
  }).then((body) => {
    if (body.ok) {
      return body.members;
    } else {
      throw new Error(body.error);
    }
  });
}

function findDevsFromUsers(usersList, usersFromChannel, exclusions = [], guides = []) {
  return usersList.filter((user) => !user.deleted)
      .filter((user) => usersFromChannel.includes(user.id))
      .filter((user) => !exclusions.includes(`@${user.name}`))
      .filter((user) => !guides.includes(`@${user.name}`))
      .map((user) => user.name);
}

// Shamelessly copied from https://github.com/zachwlewis/projectcodename/blob/gh-pages/pc.js
function generateCodeName() {
  const attributes = [
    // Environ
    "desert", "tundra", "mountain", "space", "field", "urban",
    // Stealth and cunning
    "hidden", "covert", "uncanny", "scheming", "decisive", "untouchable", "stalking",
    // Volitility
    "rowdy", "dangerous", "explosive", "threatening", "warring", "deadly", "killer", "insane", "wild",
    // Needs correction
    "bad", "unnecessary", "unknown", "unexpected", "waning",
    // Organic Gems and materials
    "amber", "bone", "coral", "ivory", "jet", "nacre", "pearl", "obsidian", "glass",
    // Regular Gems
    "agate", "beryl", "diamond", "opal", "ruby", "onyx", "sapphire", "emerald", "jade",
    // Colors
    "red", "orange", "yellow", "green", "blue", "violet",
    // Unsorted
    "draconic", "wireless", "spinning", "falling", "orbiting", "hunting", "chasing", "searching", "revealing", "flying", "destroyed", "inconceivable", "tarnished"
  ];

  const objects = [
    // Large cats
    "panther", "wildcat", "tiger", "lion", "cheetah", "cougar", "leopard",
    // Snakes
    "viper", "cottonmouth", "python", "boa", "sidewinder", "cobra",
    // Other predators
    "grizzly", "jackal", "falcon",
    // Prey
    "wildebeest", "gazelle", "zebra", "elk", "moose", "deer", "stag", "pony", "koala", "sloth",
    // HORSES!
    "horse", "stallion", "foal", "colt", "mare", "yearling", "filly", "gelding",
    // Mythical creatures
    "mermaid", "unicorn", "fairy", "troll", "yeti", "pegasus", "griffin", "dragon",
    // Occupations
    "nomad", "wizard", "cleric", "pilot", "captain", "commander", "general", "major", "admiral", "chef", "inspector",
    // Technology
    "mainframe", "device", "motherboard", "network", "transistor", "packet", "robot", "android", "cyborg", "display", "battery", "memory", "disk", "cartridge", "tape", "camera", "projector",
    // Sea life
    "octopus", "lobster", "crab", "barnacle", "hammerhead", "orca", "piranha",
    // Weather
    "storm", "thunder", "lightning", "rain", "hail", "sun", "drought", "snow", "drizzle",
    // Musical
    "piano", "keyboard", "guitar", "trumpet", "trombone", "flute", "cornet", "horn", "tuba", "clarinet", "saxophone", "piccolo", "violin", "harp", "cello", "drum", "organ", "banjo", "rhythm", "beat", "sound", "song",
    // Tools
    "screwdiver", "sander", "lathe", "mill", "welder", "mask", "hammer", "drill", "compressor", "wrench", "mixer", "router", "vacuum",
    // Other
    "warning", "presence", "weapon", "player", "ink", "case", "cup", "chain", "door"
  ];

  var f = attributes[Math.floor(Math.random() * attributes.length)].toUpperCase();
  var l = objects[Math.floor(Math.random() * objects.length)].toUpperCase();
  return f + " " + l;
}

app.post('/', urlencodedParser, (req, res, next) => {
  const payload = req.body;
  const channelId = payload.channel_id;
  const args = convertTextToArgs(payload.text);

  let minionsMapping = args.guides.map((guide) => []);

  if (payload.token === process.env.SLACK_TOKEN) {
    Promise.all([fetchUserDetails(), fetchMembersFromChannel(channelId)]).then((results) => {
      const usersList = results[0];
      const usersFromChannel = results[1];
      let result = {};
      let devs = findDevsFromUsers(usersList, usersFromChannel, args.exclusions, args.guides);
      let randomIndex = -1;
      let ctr = 0;

      while(devs.length > 0) {
        if(ctr == args.guides.length) ctr = 0;
        randomIndex = Math.floor(Math.random() * devs.length);
        minionsMapping[ctr].push(`@${devs[randomIndex]}`);
        devs.splice(randomIndex, 1);
        ctr = ctr + 1;
      }

      args.guides.forEach((guide, index) => result[guide] = minionsMapping[index])

      res.send({
        attachments: args.guides.map((guide) => {
          return {
            color: randomColor(),
            title: `Team ${generateCodeName()}`,
            text: `${guide}\n${result[guide].join('\n')}`
          };
        })
      });
    });
  }
});

http.createServer(app).listen(6543);
