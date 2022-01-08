import BaseCommand from "../BaseCommand";
import { client, DungeonGang } from "../../index";
import { ContextMenuCommandBuilder, SlashCommandBuilder } from "@discordjs/builders";
import {
    CommandInteraction,
    MessageContextMenuInteraction,
    MessageEmbed,
    UserContextMenuInteraction
} from "discord.js";
import { ephemeralMessage, errorEmbed, fmtMSS, getMojang, getMojangFromUuid } from "../../util/Functions";
import { MongoUser } from "../../util/Mongo";
import VerificationManager, { VerifyErrors } from "../../util/VerificationManager";
import { ApplicationCommandType } from "discord-api-types";

module.exports = class ForceUpdateCommand extends BaseCommand {
    constructor(client: DungeonGang) {
        super(client, {
            name: "forceupdate",
            description: "Forces a user to update.",
            category: "Staff",
            usage: "forceupdate <user>",
            guildOnly: true,
            permLevel: 2,
            slashCommandBody: new SlashCommandBuilder()
                .setName("forceupdate")
                .setDescription("Forces a user to update.")
                .addUserOption(option => option
                    .setName("user")
                    .setRequired(true)
                    .setDescription("The user to force update.")
                ),
            messageContextMenuCommandBody: new ContextMenuCommandBuilder()
                .setName("Force Update")
                .setType(ApplicationCommandType.Message),
            userContextMenuCommandBody: new ContextMenuCommandBuilder()
                .setName("Force Update")
                .setType(ApplicationCommandType.User)
        });
    }
    async execute(interaction: CommandInteraction | MessageContextMenuInteraction | UserContextMenuInteraction) {
        await interaction.deferReply({
            ephemeral: ephemeralMessage(interaction.channelId)
        })

        let member;

        if (interaction.isCommand()) {
            const user = interaction.options.getUser("user", true);
            member = await this.fetchMember(user.id, interaction.guild!)
        } else {
            member = await this.getMemberFromContextMenuInteraction(interaction);
        }

        if (!member) {
            return interaction.editReply({
                embeds: [errorEmbed("That user is not in this server.")]
            });
        }

        let mongoUser = await this.client.mongo.getUserByDiscord(member.user.id) as MongoUser | undefined;

        let mojang;

        if (!mongoUser) {
            let username;
            try {
                username = member.displayName.split(" ")[1].replace(/\W/g, '')
            } catch (error) {
                return interaction.editReply({
                    embeds: [
                        errorEmbed(`Failed to get username for ${member.toString()} from nickname. This user is also not in the database. Please use /forceverify instead.`)
                    ]
                })
            }

            mojang = await getMojang(username);

            if (mojang === "error" || !mojang) {
                return interaction.editReply({
                    embeds: [
                        errorEmbed(`Could not find user \`${username}\`. This user is also not in the database. Please use /forceverify instead.`)
                    ]
                })
            }
        } else {
            mojang = await getMojangFromUuid(mongoUser.uuid);
            if (mojang === "error" || !mojang) {
                return interaction.editReply({
                    embeds: [
                        errorEmbed(`An error occured while fetching the user's UUID. Please use /forceverify instead.`)
                    ]
                })
            }
        }
        const response = await VerificationManager.verify(mojang.name, member, {
            handler: "Force Update",
            forceUpdate: {
                mojang
            }
        })

        if (!response.success) {
            let embed: MessageEmbed;
            switch (response.code!) {
                case VerifyErrors.HYPIXEL_ERROR: {
                    embed = errorEmbed(`There was an error while accessing the Hypixel API: ${response.message}.`)
                    break;
                }
                case VerifyErrors.NO_DISCORD: {
                    embed = errorEmbed(`There is no linked Discord account on Hypixel for \`${mojang.name}\`. Please use /forceverify instead.`)
                    break;
                }
                case VerifyErrors.HYPIXEL_DISCORD_MISMATCH: {
                    embed = errorEmbed(`The minecraft account \`${response.mojang!.name}\` is linked to a different discord account on Hypixel. \n\nTheir Tag: ${member.user.tag}\nHypixel Tag: ${response.tag}\n\nPlease use /forceverify instead.`)
                    break;
                }
                case VerifyErrors.MONGO_DISCORD_MISMATCH: {
                    embed = errorEmbed(`The minecraft account \`${response.mojang!.name}\` is linked to a different discord account on this server. Please tell the user to leave the server on their other account (${response.member!.toString()}) and try again or use /forceverify instead.`)
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
            const stats = "Catacombs Level: " + response.dungeons!.cataLevel
                + "\nSecrets: " + response.dungeons!.secrets
                + "\nBlood Mob Kills: " + response.dungeons!.bloodMobs
                + "\nFloor 7 S+: " + (response.dungeons!.floorSeven ? fmtMSS(response.dungeons!.floorSeven!) : "N/A")
                + "\nMaster Five S+: " + (response.dungeons!.masterFive ? fmtMSS(response.dungeons!.masterFive!) : "N/A")
                + "\nMaster Six S+: " + (response.dungeons!.masterSix ? fmtMSS(response.dungeons!.masterSix!) : "N/A")


            return interaction.editReply({
                embeds: [
                    new MessageEmbed()
                        .setTitle(`Force Updated!`)
                        .setDescription(`Successfully force updated <@${member.user.id}> as \`${mojang.name}\`!`)
                        .addField("**Stats Overview**", stats)
                        .setFooter(client.user?.username as string, client.user?.avatarURL()?.toString())
                        .setColor("#B5FF59")
                        .setTimestamp()
                ]
            })
        }
    }
}