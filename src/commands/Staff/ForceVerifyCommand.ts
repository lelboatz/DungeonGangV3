import BaseCommand from "../BaseCommand";
import { client, DungeonGang } from "../../index";
import { SlashCommandBuilder } from "@discordjs/builders";
import { CommandInteraction, Guild, GuildMember, GuildMemberRoleManager, MessageEmbed } from "discord.js";
import {
    cataLevel as convertXp,
    embed,
    ephemeralMessage,
    errorEmbed,
    fmtMSS,
    getMojang,
    highestCataProfile
} from "../../util/Functions";
import { MongoUser } from "../../util/Mongo";
import { userSchema } from "../../util/Schema";
import EmojiManager from "../../util/EmojiManager";
import VerificationManager, { VerifyErrors } from "../../util/VerificationManager";

module.exports = class ForceVerifyCommand extends BaseCommand {
    constructor(client: DungeonGang) {
        super(client, {
            name: "forceverify",
            category: "Staff",
            usage: "forceverify <user>",
            description: "Force a user to verify.",
            guildOnly: true,
            permLevel: 2,
            slashCommandBody: new SlashCommandBuilder()
                .setName("forceverify")
                .setDescription("Force a user to verify.")
                .addUserOption(option => option
                    .setName("user")
                    .setRequired(true)
                    .setDescription("The user to verify.")
                )
                .addStringOption(option => option
                    .setName("username")
                    .setRequired(true)
                    .setDescription("Minecraft username.")
                )
                .addStringOption(option => option
                    .setName("profile")
                    .setDescription("Skyblock profile.")
                )
                .addIntegerOption(option => option
                    .setName("cata_level")
                    .setDescription("The Cata level of the user.")
                )
                .addBooleanOption(option => option
                    .setName("bypass_discord")
                    .setDescription("Whether to bypass Discord verification.")
                )
                .addBooleanOption(option => option
                    .setName("api_check")
                    .setDescription("Whether to check the API for the user's Cata level & Role qualifications.")
                )
                .addBooleanOption(option => option
                    .setName("override_duplicate")
                    .setDescription("Whether to override a duplicate user.")
                )
        });
    }
    async execute(interaction: CommandInteraction) {
        await interaction.deferReply({
            ephemeral: ephemeralMessage(interaction.channelId)
        })

        const user = interaction.options.getUser("user", true);
        const username = interaction.options.getString("username", true);
        const cataLevel = interaction.options.getInteger("cata_level");
        const apiCheck = interaction.options.getBoolean("api_check");
        const bypassDiscord = interaction.options.getBoolean("bypass_discord");
        const overrideDuplicate = interaction.options.getBoolean("override_duplicate");
        const profile = interaction.options.getString("profile");

        const member = await this.fetchMember(user.id, interaction.guild as Guild);
        if (!member) {
            return interaction.editReply({
                embeds: [errorEmbed("That user is not in this server.")]
            });
        }

        const response = await VerificationManager.verify(username, member, {
            cataLevel,
            bypassApi: apiCheck,
            bypassDiscord,
            overrideDuplicate,
            profile,
            handler: "Force Verify"
        })

        if (!response.success) {
            let embed: MessageEmbed;
            switch (response.code!) {
                case VerifyErrors.INVALID_USERNAME: {
                    embed = errorEmbed(`Could not find a user with the username \`${username}\`.`);
                    break;
                }
                case VerifyErrors.HYPIXEL_ERROR: {
                    embed = errorEmbed(`There was an error while accessing the Hypixel API: ${response.message}, set api_check to false to bypass this check.`);
                    break;
                }
                case VerifyErrors.NO_DISCORD: {
                    embed = errorEmbed(`There is no linked Discord account on Hypixel for \`${username}\`. Set bypass_discord to true to bypass Discord verification.`);
                    break;
                }
                case VerifyErrors.HYPIXEL_DISCORD_MISMATCH: {
                    embed = errorEmbed(`The minecraft account \`${response.mojang!.name}\` is linked to a different discord account on Hypixel. \n\nTheir Tag: ${member.user.tag}\nHypixel Tag: ${response.tag}\n\nSet bypass_discord to true to bypass Discord verification.`);
                    break;
                }
                case VerifyErrors.MONGO_DISCORD_MISMATCH: {
                    embed = errorEmbed(`The minecraft account \`${response.mojang!.name}\` is linked to a different discord account on this server. Please tell the user to leave the server on their other account (${response.member!.toString()}) and try again. Set override_duplicate to true to override the duplicate.`);
                    break;
                }
                case VerifyErrors.INVALID_CATA_LEVEL: {
                    embed = errorEmbed(`Please enter a value between 1 and 60 for the Catacombs Level.`);
                    break;
                }
                case VerifyErrors.MISSING_CATA_LEVEL: {
                    embed = errorEmbed(`Please enter a Catacombs Level to bypass the API check.`);
                    break;
                }
                case VerifyErrors.INVALID_PROFILE: {
                    embed = errorEmbed(`Unable to find a Skyblock profile with the name \`${profile}\`.`);
                    break;
                }
                default: {
                    embed = errorEmbed(`An unknown error has occurred. Please report this to the bot dev.`);
                }
            }
            return interaction.editReply({
                embeds: [
                    embed
                ]
            })
        } else {
            if (apiCheck === false) {
                return interaction.editReply({
                    embeds: [
                        embed("Force Verified", `Successfully force verified ${member.toString()} as \`${response.mojang!.name}\` and set their cata level to ${cataLevel}.`)
                    ]
                })
            }
            const stats = "Catacombs Level: " + response.dungeons!.cataLevel
                + "\nSecrets: " + response.dungeons!.secrets
                + "\nBlood Mob Kills: " + response.dungeons!.bloodMobs
                + "\nMaster Five S+: " + (response.dungeons!.masterFive ? fmtMSS(response.dungeons!.masterFive!) : "N/A")
                + "\nMaster Six S+: " + (response.dungeons!.masterSix ? fmtMSS(response.dungeons!.masterSix!) : "N/A")
                + "\nMaster Seven S+: " + (response.dungeons!.masterSeven ? fmtMSS(response.dungeons!.masterSeven!) : "N/A")

            return interaction.editReply({
                embeds: [
                    new MessageEmbed()
                        .setTitle(`Force Verified!`)
                        .setDescription(`Successfully force verified <@${member.user.id}> as \`${response.mojang!.name}\`!`)
                        .addField("**Stats Overview**", stats)
                        .setFooter(client.user?.username as string, client.user?.avatarURL()?.toString())
                        .setColor("#B5FF59")
                        .setTimestamp()
                ]
            })
        }
    }
}