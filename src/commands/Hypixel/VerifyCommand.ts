import BaseCommand from "../BaseCommand";
import { client, DungeonGang } from "../../index";
import { SlashCommandBuilder } from "@discordjs/builders";
import { CommandInteraction, GuildMember, GuildMemberRoleManager, MessageEmbed } from "discord.js";
import { cataLevel, embed, errorEmbed, fmtMSS, getMojang, highestCataProfile } from "../../util/Functions";
import { userSchema } from "../../util/Schema";
import { MongoUser } from "../../util/Mongo";
import EmojiManager from "../../util/EmojiManager";
import VerificationManager, { VerifyErrors } from "../../util/VerificationManager";

module.exports = class VerifyCommand extends BaseCommand {
    constructor(client: DungeonGang) {
        super(client,{
            name: "verify",
            category: "Hypixel",
            description: "Verify a user.",
            usage: "verify <user>",
            guildOnly: true,
            permLevel: 0,
            slashCommandBody: new SlashCommandBuilder()
                .setName("verify")
                .setDescription("Verify as a user")
                .addStringOption(option => option
                    .setName("username")
                    .setRequired(true)
                    .setDescription("Your minecraft username")
                )
        });
    }

    async execute(interaction: CommandInteraction) {
        await interaction.deferReply({
            ephemeral: true
        })

        if (!this.client.config.discord.verifyChannels.includes(interaction.channelId)) {
            return interaction.editReply({
                embeds: [
                    errorEmbed("You can only use this command in a verification channel.")
                ]
            })
        }
        const username = interaction.options.getString("username", true);

        const response = await VerificationManager.verify(username, interaction.member as GuildMember, {
            handler: "/verify",
        });

        if (!response.success) {
            let embed: MessageEmbed;
            switch (response.code!) {
                case VerifyErrors.INVALID_USERNAME: {
                    embed = errorEmbed(`Could not find a user with the username \`${username}\`.`);
                    break;
                }
                case VerifyErrors.HYPIXEL_ERROR: {
                    embed = errorEmbed(`There was an error while accessing the Hypixel API: ${response.message}`);
                    break;
                }
                case VerifyErrors.NO_DISCORD: {
                    embed = errorEmbed(`There is no linked Discord account on Hypixel for \`${username}\`, please refer to the gif below for help with linking your discord account.`, true);
                    break;
                }
                case VerifyErrors.HYPIXEL_DISCORD_MISMATCH: {
                    embed = errorEmbed(`The minecraft account \`${response.mojang!.name}\` is linked to a different discord account on Hypixel. \n\nYour Tag: ${interaction.user.tag}\nHypixel Tag: ${response.tag}\n\nPlease see the gif below if you need help with linking your discord account.`, true)
                    break;
                }
                case VerifyErrors.MONGO_DISCORD_MISMATCH: {
                    embed = errorEmbed(`The minecraft account \`${response.mojang!.name}\` is linked to a different discord account on this server. Please leave the server on your other account (${response.member!.toString()}) and try again.`)
                    break;
                }
                default: {
                    embed = errorEmbed(`An unknown error has occurred. Please report this to a staff member.`);
                }
            }
            return interaction.editReply({
                embeds: [
                    embed
                ]
            })
        } else {

            const stats = "Catacombs Level: " + response.dungeons?.cataLevel
                + "\nSecrets: " + response.dungeons?.secrets
                + "\nBlood Mob Kills: " + response.dungeons?.bloodMobs
                + "\nMaster Five S+: " + (response.dungeons?.masterFive ? fmtMSS(response.dungeons.masterFive!) : "N/A")
                + "\nMaster Six S+: " + (response.dungeons?.masterSix ? fmtMSS(response.dungeons.masterSix!) : "N/A")
                + "\nMaster Seven S+: " + (response.dungeons?.masterSeven ? fmtMSS(response.dungeons.masterSeven!) : "N/A")

            return interaction.editReply({
                embeds: [
                    new MessageEmbed()
                        .setTitle(`Verified!`)
                        .setDescription(`Successfully verified as \`${response.mojang?.name}\`!`)
                        .addField("**Stats Overview**", stats)
                        .setFooter(client.user?.username as string, client.user?.avatarURL()?.toString())
                        .setColor("#B5FF59")
                        .setTimestamp()
                ]
            })
        }

    }
}