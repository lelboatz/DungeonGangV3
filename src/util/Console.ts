// @ts-nocheck

import { client } from "../index";
import { TextChannel } from "discord.js";

const Discord = require('discord.js');

const logChannel = client.channels.cache.get(client.config.discord.logChannel) as TextChannel

let newConsole = (function (oldCons) {
    let newFuncs = {
        log: function (text: any) {
            if (logChannel) {
                let error_embed = new Discord.MessageEmbed()
                    .setColor('0x00bfff')
                    .setDescription(clean(text))
                logChannel.send({
                    embeds: [error_embed]
                }).catch()
            }
            oldCons.log(text);
        },
        info: function (text: any) {
            if (logChannel) {
                let error_embed = new Discord.MessageEmbed()
                    .setColor('0x00bfff')
                    .setDescription(clean(text))
                logChannel.send({
                    embeds: [error_embed]
                }).catch()
            }
            oldCons.info(text);
        },
        warn: function (text: any) {
            if (logChannel) {
                let error_embed = new Discord.MessageEmbed()
                    .setColor('0x00bfff')
                    .setDescription(clean(text))
                logChannel.send({
                   embeds: [error_embed]
                }).catch()
            }
            oldCons.warn(text);

        },
        error: function (text: any) {
            if (logChannel) {
                let error_embed = new Discord.MessageEmbed()
                    .setColor('0x00bfff')
                    .setDescription(clean(text))
                logChannel.send({
                    embeds: [error_embed]
                }).catch()
            }
            oldCons.error(text);
        },
        exception: function (text: any) {
            if (logChannel) {
                let error_embed = new Discord.MessageEmbed()
                    .setColor('0x00bfff')
                    .setDescription(clean(text))
                logChannel.send({
                    embeds: [error_embed]
                }).catch()
            }
            oldCons.error(text)

        }
    };
    Object.keys(oldCons).forEach((func) => {
        if (newFuncs[func] === undefined) {
            newFuncs[func] = console[func]
        }
    })
    return newFuncs
}(console));
console = newConsole;

function clean(text: any) {
    if (typeof text !== "string") text = require("util").inspect(text, { depth: 1 });
    text = text
        .replace(/`/g, "`" + String.fromCharCode(8203))
        .replace(/@/g, "@" + String.fromCharCode(8203))
        .replace(client.config.discord.token, "mfa.VkO_2G4Qv3T--NO--lWetW_tjND--TOKEN--QFTm6YGtzq9PH--4U--tG0");
    return text;
}

process.on('uncaughtException', err => {
    console.log(err.stack, true)
    process.exit(1)
})

process.on('unhandledRejection', err => {
    console.log(err.stack)
})