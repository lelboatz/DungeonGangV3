import { client, DungeonGang } from "../index";
import { cataLevel, errorEmbed, fmtMSS, getMojang, highestCataProfile, highestCataProfileOld } from "./Functions";
import {
    ButtonInteraction,
    GuildMember,
    Message,
    MessageActionRow,
    MessageButton, MessageEmbed, MessageSelectMenu, SelectMenuInteraction,
    Snowflake,
    TextChannel
} from "discord.js";
import { pollSchema } from "./Schema";
import { MongoPoll } from "./Mongo";

class PollManager {
    client: DungeonGang
    constructor(client: DungeonGang) {
        this.client = client;
    }

    init() {
        setInterval(async () => {
            const polls = await this.client.mongo.getActivePolls()
            if (!polls) return;
            polls.forEach(async (poll) => {
                if (poll.endDate < (new Date().getTime() / 1000)) {
                    await this.endPoll(poll._id)
                }
            })
        }, 60000)
        return this;
    }

    async create(username: string, identifier: string): Promise<{ success: false, message: string} | { success: true, message: string, poll: MongoPoll}> {
        const existingPoll = await this.client.mongo.getPollByIdentifier(identifier)

        if (existingPoll) {
            return {
                success: false,
                message: "A poll with that identifier already exists."
            }
        }

        const mojang = await getMojang(username);
        if (!mojang || mojang === "error") {
            return {
                success: false,
                message: "Could not find user \`" + username + "\`."
            }
        }

        let player, profiles;
        try {
            player = await this.client.hypixel.player.uuid(mojang.id);
            profiles = await this.client.hypixel.skyblock.profiles.uuid(mojang.id);
        } catch (error: any) {
            console.error(error);
            return {
                success: false,
                message: error.message.toString()
            }
        }

        let profile = highestCataProfileOld(profiles, mojang.id);

        let stats;

        if (!profile) {
            stats = {
                cataLevel: 0,
                secrets: player.achievements.skyblock_treasure_hunter ?? 0,
                bloodMobs: 0,
                masterSeven: undefined,
                masterSevenCompletions: 0,
            }
        } else {
            stats = {
                cataLevel: cataLevel(profile.members[mojang.id].dungeons?.dungeon_types.catacombs.experience ?? 0),
                secrets: player.achievements.skyblock_treasure_hunter ?? 0,
                bloodMobs: (profile.members[mojang.id].stats.kills_watcher_summon_undead ?? 0) + (profile.members[mojang.id].stats.kills_watcher_summon_skeleton ?? 0) + (profile.members[mojang.id].stats.kills_master_watcher_summon_undead ?? 0),
                masterSeven: profile.members[mojang.id].dungeons?.dungeon_types.master_catacombs?.fastest_time_s_plus?.[7] ?? undefined,
                masterSevenCompletions: profile.members[mojang.id].dungeons?.dungeon_types.master_catacombs?.tier_completions?.[7] ?? 0,
            }
        }

        const pollChannel = await this.client.channels.fetch(this.client.config.discord.pollChannel) as TextChannel | null

        if (!pollChannel) {
            return {
                success: false,
                message: "Poll channel not found. Please change the poll channel in the config and try again."
            }
        }

        let endDate = new Date();
        endDate.setHours(endDate.getHours() + 12);

        let message;

        try {
            message = await pollChannel.send({
                embeds: [
                    {
                        "color": "#B5FF59",
                        "footer": {
                            "icon_url": this.client.user?.avatarURL()?.toString(),
                            "text": "Dungeon Gang Polls"
                        },
                        "thumbnail": {
                            "url": this.client.user?.avatarURL()?.toString()
                        },
                        "author": {
                            "name": "➤ " + mojang.name + ` (${identifier})`,
                            "icon_url": `https://crafatar.com/avatars/${mojang.id}?overlay`,
                            "url": "https://sky.shiiyu.moe/stats/" + mojang.name
                        },
                        timestamp: new Date(),
                        "fields": [
                            {
                                "name": "**Catacombs Level**",
                                "value": stats.cataLevel.toFixed(2),
                                "inline": true
                            },
                            {
                                "name": "**Master 7 S+ PB**",
                                "value": stats.masterSeven ? fmtMSS(stats.masterSeven) : "N/A",
                                "inline": true
                            },
                            {
                                "name": "**Master 7 Completions**",
                                "value": stats.masterSevenCompletions.toString(),
                                "inline": true
                            },
                            {
                                "name": "**Secrets**",
                                "value": stats.secrets.toString(),
                                "inline": true
                            },
                            {
                                "name": "**Blood Mob Kills**",
                                "value": stats.bloodMobs.toString(),
                                "inline": true
                            },
                            {
                                "name": ":thumbsup: :zipper_mouth: :thumbsdown:",
                                "value": "Please be honest when voting, these polls are held to measure someone's skill. Not their popularity or personalities",
                                "inline": false
                            },
                            {
                                "name": "**Anonymous**",
                                "value": "True",
                                "inline": true
                            },
                            {
                                "name": "**Poll End Time**",
                                "value": `<t:${Math.floor(endDate.getTime() / 1000)}:R>`,
                                "inline": true
                            }
                        ]
                    }
                ],
                components: [
                    new MessageActionRow()
                        .addComponents([
                            new MessageButton()
                                .setEmoji("👍")
                                .setStyle("PRIMARY")
                                .setCustomId(`POSITIVE_VOTE`),
                            new MessageButton()
                                .setEmoji("🤐")
                                .setStyle("PRIMARY")
                                .setCustomId(`NEUTRAL_VOTE`),
                            new MessageButton()
                                .setEmoji("👎")
                                .setStyle("PRIMARY")
                                .setCustomId(`NEGATIVE_VOTE`),
                            new MessageButton()
                                .setLabel("End Poll")
                                .setStyle("DANGER")
                                .setCustomId(`END_POLL`)
                        ])
                ]
            })
        } catch (error: any) {
            return {
                success: false,
                message: error.message.toString()
            }
        }

        const poll = pollSchema(message, mojang, identifier)

        poll.stats = stats;

        await this.client.mongo.addPoll(poll)

        return {
            success: true,
            message: `Successfully created poll for ${mojang.name} in <#${pollChannel.id}>!`,
            poll,
        }
    }

    async getPoll(id: string): Promise<MongoPoll | null | undefined> {
        return this.client.mongo.getPoll(id)
    }

    async getPolls(uuid: string) {
        return this.client.mongo.getPolls(uuid)
    }

    async endPoll(id: Snowflake) {
        const poll = await this.getPoll(id) as MongoPoll | null | undefined

        if (!poll) {
            return {
                success: false,
                message: "Poll not found."
            }
        }

        if (!poll.active) {
            return {
                success: false,
                message: "Poll is not active."
            }
        }

        const channel = await this.client.channels.fetch(poll.channel) as TextChannel | null

        const message = await channel?.messages.fetch(poll._id) as Message | null

        await this.client.mongo.endPoll(poll._id)

        let editedMessage = false;

        if (message) {
            try {
                await message.edit({
                    embeds: [
                        this.pollEndedEmbed(poll)
                    ],
                    components: [
                        new MessageActionRow()
                            .addComponents([
                                new MessageButton()
                                    .setEmoji("👍")
                                    .setStyle("PRIMARY")
                                    .setCustomId(`POSITIVE_VOTE`)
                                    .setDisabled(true),
                                new MessageButton()
                                    .setEmoji("🤐")
                                    .setStyle("PRIMARY")
                                    .setCustomId(`NEUTRAL_VOTE`)
                                    .setDisabled(true),
                                new MessageButton()
                                    .setEmoji("👎")
                                    .setStyle("PRIMARY")
                                    .setCustomId(`NEGATIVE_VOTE`)
                                    .setDisabled(true),
                                new MessageButton()
                                    .setLabel("End Poll")
                                    .setStyle("DANGER")
                                    .setCustomId(`END_POLL`)
                                    .setDisabled(true)
                            ])
                    ]
                })
                editedMessage = true;
            } catch (error: any) {
                console.error(`Unable to edit poll message ${poll._id}: ${error.message}`);
            }

        }

        return {
            success: true,
            message: `Successfully edited poll ${poll._id}! ${editedMessage ? "" : "I was unable to edit the poll message. More information can be found in my logging channel."}`
        }
    }

    async onInteraction(interaction: ButtonInteraction) {
        await interaction.deferReply({
            ephemeral: true,
        })

        const poll = await this.getPoll(interaction.message.id);

        if (!poll) {
            return interaction.editReply({
                content: "Poll not found, please report this to a staff member."
            })
        }

        const votes = poll.votes;

        switch (interaction.customId) {
                case "POSITIVE_VOTE": {
                    const member = interaction.member as GuildMember
                    if (member.roles.cache.has(this.client.config.discord.roles.misc.pollBlacklist)) {
                        return interaction.editReply({
                            content: "You are blacklisted from voting in polls."
                        })
                    }
                    if (!member.roles.cache.has(this.client.config.discord.roles.topPlayer.plus)) {
                        return interaction.editReply({
                            content: "You must be a top player+ to vote in this poll."
                        })
                    }
                    if (votes.negative.includes(interaction.user.id)) {
                        votes.negative.splice(votes.negative.indexOf(interaction.user.id), 1);
                        votes.positive.push(interaction.user.id);
                        await interaction.editReply({
                            content: "Vote changed from 👎 to 👍"
                        })
                    } else if (votes.neutral.includes(interaction.user.id)) {
                        votes.neutral.splice(votes.neutral.indexOf(interaction.user.id), 1);
                        votes.positive.push(interaction.user.id);
                        await interaction.editReply({
                            content: "Vote changed from 🤐 to 👍"
                        })
                    } else if (!votes.positive.includes(interaction.user.id)) {
                        votes.positive.push(interaction.user.id);
                        await interaction.editReply({
                            content: "Your vote has been recorded as 👍"
                        })
                    } else {
                        votes.positive.splice(votes.positive.indexOf(interaction.user.id), 1);
                        await interaction.editReply({
                            content: "Your 👍 vote has been removed"
                        })
                    }
                    break;
                }
                case "NEUTRAL_VOTE": {
                    const member = interaction.member as GuildMember
                    if (member.roles.cache.has(this.client.config.discord.roles.misc.pollBlacklist)) {
                        return interaction.editReply({
                            content: "You are blacklisted from voting in polls."
                        })
                    }
                    if (!member.roles.cache.has(this.client.config.discord.roles.topPlayer.plus)) {
                        return interaction.editReply({
                            content: "You must be a top player+ to vote in this poll."
                        })
                    }
                    if (votes.negative.includes(interaction.user.id)) {
                        votes.negative.splice(votes.negative.indexOf(interaction.user.id), 1);
                        votes.neutral.push(interaction.user.id);
                        await interaction.editReply({
                            content: "Vote changed from 👎 to 🤐"
                        })
                    } else if (votes.positive.includes(interaction.user.id)) {
                        votes.positive.splice(votes.positive.indexOf(interaction.user.id), 1);
                        votes.neutral.push(interaction.user.id);
                        await interaction.editReply({
                            content: "Vote changed from 👍 to 🤐"
                        })
                    } else if (!votes.neutral.includes(interaction.user.id)) {
                        votes.neutral.push(interaction.user.id);
                        await interaction.editReply({
                            content: "Your vote has been recorded as 🤐"
                        })
                    } else {
                        votes.neutral.splice(votes.neutral.indexOf(interaction.user.id), 1);
                        await interaction.editReply({
                            content: "Your 🤐 vote has been removed"
                        })
                    }
                    break;
                }
                case "NEGATIVE_VOTE": {
                    const member = interaction.member as GuildMember
                    if (member.roles.cache.has(this.client.config.discord.roles.misc.pollBlacklist)) {
                        return interaction.editReply({
                            content: "You are blacklisted from voting in polls."
                        })
                    }
                    if (!member.roles.cache.has(this.client.config.discord.roles.topPlayer.plus)) {
                        return interaction.editReply({
                            content: "You must be a top player+ to vote in this poll."
                        })
                    }
                    if (votes.positive.includes(interaction.user.id)) {
                        votes.positive.splice(votes.positive.indexOf(interaction.user.id), 1);
                        votes.negative.push(interaction.user.id);
                        await interaction.editReply({
                            content: "Vote changed from 👍 to 👎"
                        })
                    } else if (votes.neutral.includes(interaction.user.id)) {
                        votes.neutral.splice(votes.neutral.indexOf(interaction.user.id), 1);
                        votes.negative.push(interaction.user.id);
                        await interaction.editReply({
                            content: "Vote changed from 🤐 to 👎"
                        })
                    } else if (!votes.negative.includes(interaction.user.id)) {
                        votes.negative.push(interaction.user.id);
                        await interaction.editReply({
                            content: "Your vote has been recorded as 👎"
                        })
                    } else {
                        votes.negative.splice(votes.negative.indexOf(interaction.user.id), 1);
                        await interaction.editReply({
                            content: "Your 👎 vote has been removed"
                        })
                    }
                    break;
                }
                case "END_POLL": {
                    if (this.client.getPermissionLevel(interaction.member as GuildMember | null) < 1) {
                        return interaction.editReply({
                            content: "You don't have permission to end the poll"
                        })
                    }
                    await this.endPoll(interaction.message.id);

                    return interaction.editReply({
                        content: "Successfully ended poll."
                    })
                }
        }
        return this.client.mongo.updateVotes(poll._id, votes);
    }

    pollInProgressEmbed(poll: MongoPoll) {
        return {
            "color": "#B5FF59",
            "footer": {
                "icon_url": this.client.user?.avatarURL()?.toString(),
                "text": "Dungeon Gang Polls"
            },
            "thumbnail": {
                "url": this.client.user?.avatarURL()?.toString()
            },
            "author": {
                "name": "➤ " + poll.username + (poll.identifier ? ` (${poll.identifier})` : ""),
                "icon_url": `https://crafatar.com/avatars/${poll.uuid}?overlay`,
                "url": "https://sky.shiiyu.moe/stats/" + poll.username
            },
            timestamp: new Date(),
            "fields": [
                {
                    "name": "**Catacombs Level**",
                    "value": poll.stats.cataLevel.toFixed(2),
                    "inline": true
                },
                {
                    "name": "**Master 7 S+ PB**",
                    "value": poll.stats.masterSeven ? fmtMSS(poll.stats.masterSeven) : "N/A",
                    "inline": true
                },
                {
                    "name": "**Master 7 Completions**",
                    "value": poll.stats.masterSevenCompletions.toString(),
                    "inline": true
                },
                {
                    "name": "**Secrets**",
                    "value": poll.stats.secrets.toString(),
                    "inline": true
                },
                {
                    "name": "**Blood Mob Kills**",
                    "value": poll.stats.bloodMobs.toString(),
                    "inline": true
                },
                {
                    "name": `${poll.votes.positive.length} :thumbsup: ${poll.votes.neutral.length} :zipper_mouth: ${poll.votes.negative.length} :thumbsdown:`,
                    "value": "Please be honest when voting, these polls are held to measure someone's skill. Not their popularity or personalities",
                    "inline": false
                },
                {
                    "name": "**Anonymous**",
                    "value": "True",
                    "inline": true
                },
                {
                    "name": "**Poll End Time**",
                    "value": `<t:${Math.floor(poll.endDate)}:R>`,
                    "inline": true
                }
            ]
        } as unknown as MessageEmbed
    }

    pollEndedEmbed(poll: MongoPoll) {
        return {
            "color": "#B5FF59",
            "footer": {
                "icon_url": this.client.user?.avatarURL()?.toString(),
                "text": "Dungeon Gang Polls"
            },
            "thumbnail": {
                "url": this.client.user?.avatarURL()?.toString()
            },
            "author": {
                "name": "➤ " + poll.username + (poll.identifier ? ` (${poll.identifier})` : ""),
                "icon_url": `https://crafatar.com/avatars/${poll.uuid}?overlay`,
                "url": "https://sky.shiiyu.moe/stats/" + poll.username
            },
            timestamp: new Date(),
            "fields": [
                {
                    "name": "**Catacombs Level**",
                    "value": poll.stats.cataLevel.toFixed(2),
                    "inline": true
                },
                {
                    "name": "**Master 7 S+ PB**",
                    "value": poll.stats.masterSeven ? fmtMSS(poll.stats.masterSeven) : "N/A",
                    "inline": true
                },
                {
                    "name": "**Master 7 Completions**",
                    "value": poll.stats.masterSevenCompletions !== undefined ? poll.stats.masterSevenCompletions.toString() : "N/A",
                    "inline": true
                },
                {
                    "name": "**Secrets**",
                    "value": poll.stats.secrets.toString(),
                    "inline": true
                },
                {
                    "name": "**Blood Mob Kills**",
                    "value": poll.stats.bloodMobs.toString(),
                    "inline": true
                },
                {
                    "name": `**Results**`,
                    "value": `${poll.votes.positive.length} :thumbsup: ${poll.votes.neutral.length} :zipper_mouth: ${poll.votes.negative.length} :thumbsdown:`,
                    "inline": true
                },
                {
                    "name": "**Poll Ended**",
                    "value": `<t:${Math.floor(poll.endDate)}:R>`,
                    "inline": true
                }
            ]
        } as unknown as MessageEmbed
    }

    async onSelect(interaction: SelectMenuInteraction) {
        const userId = interaction.customId.split("_")[3]
        if (interaction.user.id !== userId) {
            return interaction.reply({
                content: "You cannot use this menu",
                ephemeral: true
            })
        }
        const poll = await this.client.mongo.getPoll(interaction.values[0]);
        if (!poll) {
            return interaction.reply({
                content: "Poll not found",
                ephemeral: true
            })
        }

        const message = interaction.message as Message
        const menu = message.components[0].components[0] as MessageSelectMenu

        const options = menu.options.map(option => {
            if (option.value === interaction.values[0]) {
                return {
                    label: option.label,
                    value: option.value,
                    default: true,
                    emoji: "📊"
                }
            }
            return {
                label: option.label,
                value: option.value,
                emoji: "📊"
            }
        })
        menu.setOptions(options)

        return interaction.update({
            embeds: [
                this.pollEndedEmbed(poll)
            ],
            components: [
                new MessageActionRow()
                    .addComponents([
                        menu
                    ])
            ]
        })
    }

}

export default new PollManager(client).init();