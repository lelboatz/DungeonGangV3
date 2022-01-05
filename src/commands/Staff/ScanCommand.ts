import BaseCommand from "../BaseCommand";
import { DungeonGang } from "../../index";
import { SlashCommandBuilder } from "@discordjs/builders";
import {
    Collection,
    CommandInteraction,
    Guild,
    GuildMember,
    MessageEmbed,
    Role,
    TextChannel
} from "discord.js";
import {
    embed,
    ephemeralMessage,
    errorEmbed,
    getMojang, getMojangFromUuid,
} from "../../util/Functions";
import { MongoUser } from "../../util/Mongo";
import VerificationManager, { VerifyErrors } from "../../util/VerificationManager";

module.exports = class ScanCommand extends BaseCommand {
    constructor(client: DungeonGang) {
        super(client, {
            name: "scan",
            description: "Scans a role for members and adds them to the database.",
            category: "Staff",
            usage: "scan <role>",
            guildOnly: true,
            permLevel: 2,
            slashCommandBody: new SlashCommandBuilder()
                .setName("scan")
                .setDescription("Scans a role for members and adds them to the database.")
                .addRoleOption(option => option
                    .setName("role")
                    .setDescription("The role to scan.")
                    .setRequired(true)
                )
                .addChannelOption(option => option
                    .setName("channel")
                    .setDescription("The channel to send the results to.")
                    .setRequired(false)
                )
        })
    }
    async execute(interaction: CommandInteraction) {
        await interaction.deferReply({
            ephemeral: ephemeralMessage(interaction.channelId)
        })

        const role = interaction.options.getRole("role", true) as Role
        let channel = interaction.options.getChannel("channel")
        const guild = interaction.guild as Guild

        if (channel && channel.type !== "GUILD_TEXT") {
            return interaction.editReply({
                embeds: [
                    errorEmbed(`The channel must be a text channel.`)
                ]
            })
        }

        if (!channel) {
            channel = await guild.channels.fetch(this.client.config.discord.logChannel) as TextChannel
        }

        let members = await guild.members.fetch()
        members = members.filter(member => member.roles.cache.has(role.id))

        if (members.size === 0) {
            return interaction.editReply({
                embeds: [
                    errorEmbed(`No members found in ${role.toString()}.`)
                ]
            })
        }

        await interaction.editReply({
            embeds: [
                embed("Scanning...", `Found ${members.size} members in the role <@&${role.id}>. ${(channel) ? `Sending results to ${channel.toString()}` : ""}`)
            ]
        })

        return this.scan(members, channel ?? undefined, role)

    }

    async scan(members: Collection<string, GuildMember>, channel: TextChannel | undefined, role: Role) {
        for (const [, member] of members) {
            let mongoUser = await this.client.mongo.getUserByDiscord(member.user.id) as MongoUser | undefined;

            let mojang;

            if (!mongoUser) {
                let username;
                try {
                    username = member.displayName.split(" ")[1].replace(/\W/g, '')
                } catch (error) {
                    channel?.send({
                        embeds: [
                            errorEmbed(`Failed to get username for ${member.toString()} from nickname. This user is also not in the database. Skipping this member.`)
                        ]
                    })
                    continue;
                }

                mojang = await getMojang(username);

                if (mojang === "error" || !mojang) {
                    channel?.send({
                        embeds: [
                            errorEmbed(`Could not find user \`${username}\`. This user is also not in the database. Skipping this member.`)
                        ]
                    })
                    continue;
                }
            } else {
                mojang = await getMojangFromUuid(mongoUser.uuid);
                if (mojang === "error" || !mojang) {
                    channel?.send({
                        embeds: [
                            errorEmbed(`An error occured while fetching the user's UUID. Skipping this member.`)
                        ]
                    })
                    continue;
                }
            }

            const response = await VerificationManager.verify(mojang.name, member, {
                handler: `Scanning all users in the role: ${role.name}`,
                forceUpdate: {
                    mojang
                }
            })

            if (!response.success) {
                let embed: MessageEmbed;
                switch (response.code!) {
                    case VerifyErrors.HYPIXEL_ERROR: {
                        embed = errorEmbed(`There was an error while accessing the Hypixel API for ${member.toString()} (\`${mojang.name}\`): ${response.message}. Skipping this member.`)
                        break;
                    }
                    case VerifyErrors.NO_DISCORD: {
                        embed = errorEmbed(`There is no linked Discord account on Hypixel for ${member.toString()} (\`${mojang.name}\`). Skipping this member.`)
                        break;
                    }
                    case VerifyErrors.HYPIXEL_DISCORD_MISMATCH: {
                        embed = errorEmbed(`The minecraft account for ${member.toString()} (\`${mojang.name}\`) is linked to a different discord account on Hypixel. \n\nTheir Tag: ${member.user.tag}\nHypixel Tag: ${response.tag}\n\nSkipping this member.`)
                        break;
                    }
                    case VerifyErrors.MONGO_DISCORD_MISMATCH: {
                        embed = errorEmbed(`The minecraft account \`${response.mojang!.name}\` is linked to a different discord account on this server. Skipping this member.`)
                        break;
                    }
                    default: {
                        embed = errorEmbed(`An unknown error has occurred. Please report this to the bot dev.`);
                    }
                }
                channel?.send({
                    embeds: [
                        embed
                    ]
                })
            }
        }
    }
}