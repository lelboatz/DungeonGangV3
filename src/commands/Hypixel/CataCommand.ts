import BaseCommand from "../BaseCommand";
import { DungeonGang } from "../../index";
import { ContextMenuCommandBuilder, SlashCommandBuilder } from "@discordjs/builders";
import { ApplicationCommandType } from "discord-api-types"
import {
    CommandInteraction, GuildMember,
    MessageContextMenuInteraction,
    MessageEmbed,
    UserContextMenuInteraction
} from "discord.js";
import {
    cataLevel,
    ephemeralMessage,
    errorEmbed,
    fmtMSS,
    getMojang,
    highestCataProfile,
    cataXp as cataLevels,
    getProfileByName, getMojangFromUuid
} from "../../util/Functions";
import { MongoUser } from "../../util/Mongo";
import VerificationManager from "../../util/VerificationManager";

module.exports = class CataCommand extends BaseCommand {
    constructor(client: DungeonGang) {
        super(client, {
            name: "cata",
            category: "Hypixel",
            usage: "cata <user>",
            description: "Shows the Catacombs stats of a user.",
            guildOnly: true,
            permLevel: 0,
            slashCommandBody: new SlashCommandBuilder()
                .setName("cata")
                .setDescription("Shows the Catacombs stats of a user.")
                .addStringOption(option => option
                    .setName("username")
                    .setDescription("The minecraft username of the user.")
                    .setRequired(true)
                )
                .addStringOption(option => option
                    .setName("profile")
                    .setDescription("The skyblock profile of the user.")
                    .setRequired(false)
                ),
            messageContextMenuCommandBody: new ContextMenuCommandBuilder()
                .setName("Dungeon Stats")
                .setType(ApplicationCommandType.Message),
            userContextMenuCommandBody: new ContextMenuCommandBuilder()
                .setName("Dungeon Stats")
                .setType(ApplicationCommandType.User)
        })
    }
    async execute(interaction: CommandInteraction | MessageContextMenuInteraction | UserContextMenuInteraction) {
        await interaction.deferReply({
            ephemeral: ephemeralMessage(interaction.channelId)
        })

        let username, sbProfile;

        if (interaction.isCommand()) {
            username = interaction.options.getString("username", true)
            sbProfile = interaction.options.getString("profile", false)
        } else {
            let member = await this.getMemberFromContextMenuInteraction(interaction)
            if (!member) {
                return interaction.editReply({
                    embeds: [
                        errorEmbed(`That user is not in this server.`)
                    ]
                })
            }
            if (member.user.bot) {
                return interaction.editReply({
                    embeds: [
                        errorEmbed(`You cannot use this on bots!`)
                    ]
                })
            }
            const mongoUser = await this.mongo.getUserByDiscord(member.user.id)
            if (!mongoUser) {
                try {
                    username = member.displayName.split(" ")[1].replace(/\W/g, '')
                } catch {
                    return interaction.editReply({
                        embeds: [
                            errorEmbed(`Failed to get username for ${member.toString()} from nickname. This user is also not in the database.`)
                        ]
                    })
                }
            } else {
                let mojang = await getMojangFromUuid(mongoUser.uuid)
                if (mojang === "error" || !mojang) {
                    return interaction.editReply({
                        embeds: [
                            errorEmbed(`Could not find that user`)
                        ]
                    })
                }
                username = mojang.name
            }
        }

        const mojang = await getMojang(username)

        if (mojang === "error" || !mojang) {
            return interaction.editReply({
                embeds: [
                    errorEmbed(`Could not find user \`${username}\`.`)
                ]
            })
        }

        let player;
        let profile;
        try {
            player = await this.hypixel.player.uuid(mojang.id);
            if (sbProfile) {
                profile = getProfileByName(await this.hypixel.skyblock.profiles.uuid(mojang.id), sbProfile)
            } else {
                profile = highestCataProfile(await this.hypixel.skyblock.profiles.uuid(mojang.id), mojang.id)
            }
        } catch (error: any) {
            if (error.message === 'Key "profiles" is not an array.' && player) {
                profile = undefined
            } else {
                console.error(error);
                return interaction.editReply({
                    embeds: [
                        errorEmbed("There was an error while accessing the Hypixel API: " + error.message),
                    ],
                });
            }
        }

        if (sbProfile && !profile) {
            return interaction.editReply({
                embeds: [
                    errorEmbed(`Could not find profile \`${this.toProperCase(sbProfile)}\` for user \`${mojang.name}\`.`)
                ]
            })
        }

        let dungeons;

        if (!profile) {
            dungeons = {
                cataLevel: 0,

                classArcher: 0,
                classMage: 0,
                classHealer: 0,
                classBerserker: 0,
                classTank: 0,
				
				xpArcher: 0,
                xpMage: 0,
                xpHealer: 0,
                xpBerserker: 0,
                xpTank: 0,

                cataXp: 0,
                secrets: player.achievements?.skyblock_treasure_hunter ?? 0,
                bloodMobs: 0,
                floorSeven: undefined,
                masterFour: undefined,
                masterFive: undefined,
                masterSix: undefined,
                masterSeven: undefined,
                floorSevenCompletions: 0,
                masterFourCompletions: 0,
                masterFiveCompletions: 0,
                masterSixCompletions: 0,
                floorOneCompletions: 0,
                floorTwoCompletions: 0,
                floorThreeCompletions: 0,
                floorFourCompletions: 0,
                floorFiveCompletions: 0,
                floorSixCompletions: 0,
                masterOneCompletions: 0,
                masterTwoCompletions: 0,
                masterThreeCompletions: 0,
                masterSevenCompletions: 0
            }
        } else {
            dungeons = {
                cataLevel: cataLevel(profile.members[mojang.id].dungeons?.dungeon_types.catacombs.experience ?? 0).toFixed(2),
                cataXp: profile.members[mojang.id].dungeons?.dungeon_types.catacombs.experience ?? 0,
                secrets: player.achievements?.skyblock_treasure_hunter ?? 0,
                bloodMobs: (profile.members[mojang.id].stats.kills_watcher_summon_undead ?? 0) + (profile.members[mojang.id].stats.kills_watcher_summon_skeleton ?? 0) + (profile.members[mojang.id].stats.kills_master_watcher_summon_undead ?? 0),
                floorSeven: profile.members[mojang.id].dungeons?.dungeon_types.catacombs.fastest_time_s_plus?.[7] ?? undefined,
                masterFour: profile.members[mojang.id].dungeons?.dungeon_types.master_catacombs?.fastest_time_s?.[4] ?? undefined,
                masterFive: profile.members[mojang.id].dungeons?.dungeon_types.master_catacombs?.fastest_time_s_plus?.[5] ?? undefined,
                masterSix: profile.members[mojang.id].dungeons?.dungeon_types.master_catacombs?.fastest_time_s_plus?.[6] ?? undefined,
                masterSeven: profile.members[mojang.id].dungeons?.dungeon_types.master_catacombs?.fastest_time_s_plus?.[7] ?? undefined,
                floorSevenCompletions: profile.members[mojang.id].dungeons?.dungeon_types.catacombs.tier_completions?.[7] ?? 0,
                masterFourCompletions: profile.members[mojang.id].dungeons?.dungeon_types.master_catacombs?.tier_completions?.[4] ?? 0,
                masterFiveCompletions: profile.members[mojang.id].dungeons?.dungeon_types.master_catacombs?.tier_completions?.[5] ?? 0,
                masterSixCompletions: profile.members[mojang.id].dungeons?.dungeon_types.master_catacombs?.tier_completions?.[6] ?? 0,

                floorOneCompletions: profile.members[mojang.id].dungeons?.dungeon_types.catacombs.tier_completions?.[1] ?? 0,
                floorTwoCompletions: profile.members[mojang.id].dungeons?.dungeon_types.catacombs.tier_completions?.[2] ?? 0,
                floorThreeCompletions: profile.members[mojang.id].dungeons?.dungeon_types.catacombs.tier_completions?.[3] ?? 0,
                floorFourCompletions: profile.members[mojang.id].dungeons?.dungeon_types.catacombs.tier_completions?.[4] ?? 0,
                floorFiveCompletions: profile.members[mojang.id].dungeons?.dungeon_types.catacombs.tier_completions?.[5] ?? 0,
                floorSixCompletions: profile.members[mojang.id].dungeons?.dungeon_types.catacombs.tier_completions?.[6] ?? 0,

                masterOneCompletions: profile.members[mojang.id].dungeons?.dungeon_types.master_catacombs?.tier_completions?.[1] ?? 0,
                masterTwoCompletions: profile.members[mojang.id].dungeons?.dungeon_types.master_catacombs?.tier_completions?.[2] ?? 0,
                masterThreeCompletions: profile.members[mojang.id].dungeons?.dungeon_types.master_catacombs?.tier_completions?.[3] ?? 0,
                masterSevenCompletions: profile.members[mojang.id].dungeons?.dungeon_types.master_catacombs?.tier_completions?.[7] ?? 0,

                classArcher: cataLevel(profile.members[mojang.id].dungeons?.player_classes["archer"].experience ?? 0).toFixed(2),
                classMage: cataLevel(profile.members[mojang.id].dungeons?.player_classes["mage"].experience ?? 0).toFixed(2),
                classBerserker: cataLevel(profile.members[mojang.id].dungeons?.player_classes["berserk"].experience ?? 0).toFixed(2),
                classHealer: cataLevel(profile.members[mojang.id].dungeons?.player_classes["healer"].experience ?? 0).toFixed(2),
                classTank: cataLevel(profile.members[mojang.id].dungeons?.player_classes["tank"].experience ?? 0).toFixed(2),
				
				xpArcher: profile.members[mojang.id].dungeons?.player_classes["archer"].experience ?? 0,
                xpMage: profile.members[mojang.id].dungeons?.player_classes["mage"].experience ?? 0,
                xpBerserker: profile.members[mojang.id].dungeons?.player_classes["berserk"].experience ?? 0,
				xpHealer: profile.members[mojang.id].dungeons?.player_classes["healer"].experience ?? 0,
                xpTank: profile.members[mojang.id].dungeons?.player_classes["tank"].experience ?? 0
            }
        }
        let YES = "<:yes:838801988241588304>", NO = "<:no:838802013541498890>", NEUTRAL = "<:neutral:928452064286216222>", MOSIAC = "<:ironmanmoment:802725599490605097>";

        let tpm = NO, tp = NO, tpp = NO, speedrunner = NO, votedIn = false, votedOut = NEUTRAL, secretDuper = NO;

        const user = await this.mongo.getUser(mojang.id) as unknown as MongoUser;

        if (user) {
            if (user.votedOut) {
                votedOut = YES
            } else {
                votedOut = NO
            }
            if (user.votedIn) {
                votedIn = true;
            }
        }

        const verifyDungeonData = {
            cataLevel: parseFloat(dungeons.cataLevel.toString()),
            secrets: dungeons.secrets,
            bloodMobs: dungeons.bloodMobs,
            floorSeven: dungeons.floorSeven,
            masterFour: dungeons.masterFour,
            masterFive: dungeons.masterFive,
            masterSix: dungeons.masterSix,
            masterSeven: dungeons.masterSeven,
        }


        if (VerificationManager.meetsSecretDuperReqs(verifyDungeonData)) {
            secretDuper = YES;
        }

        if (VerificationManager.meetsTopPlusReqs(verifyDungeonData, {
            votedIn: user?.votedIn ?? false,
            votedOut: user?.votedOut ?? false,
        })) {
            tpp = YES;
        }

        if (VerificationManager.meetsTopNormalReqs(verifyDungeonData)) {
            tp = YES;
        }

        if (!(tpp === YES || tp === YES)) {
            if (VerificationManager.meetsTopMinusReqs(verifyDungeonData)) {
                tpm = YES;
            }
        }

        if (VerificationManager.meetsSpeedrunnerReqs(verifyDungeonData)) {
            speedrunner = YES;
        }

		let totalCompletions = dungeons.floorSevenCompletions +
                dungeons.masterFourCompletions +
                dungeons.masterFiveCompletions +
                dungeons.masterSixCompletions +
                dungeons.floorOneCompletions +
                dungeons.floorTwoCompletions + 
                dungeons.floorThreeCompletions +
                dungeons.floorFourCompletions +
                dungeons.floorFiveCompletions +
                dungeons.floorSixCompletions +
                dungeons.masterOneCompletions +
                dungeons.masterTwoCompletions +
                dungeons.masterThreeCompletions +
                dungeons.masterSevenCompletions;
				
		

		let secretAvg = dungeons.secrets / totalCompletions;

        //let classAvg = ( dungeons.classHealer + dungeons.classMage + dungeons.classArcher + dungeons.classBerserker + dungeons.classTank ) / 5;

        if (tpp === YES) tp = YES;
	if (tp === YES) tpm = YES;

        //let tpm = NO, tp = NO, tpp = NO, speedrunner = NO, votedIn = false, votedOut = NEUTRAL, secretDuper = NO;

       

		let classAvg = ((parseFloat(dungeons.classMage.toString()) + parseFloat(dungeons.classArcher.toString()) + parseFloat(dungeons.classHealer.toString()) + parseFloat(dungeons.classTank.toString()) + + parseFloat(dungeons.classBerserker.toString())) / 5).toFixed(2);

        return interaction.editReply({
            embeds: [
                new MessageEmbed()
                    .setAuthor({
                        name: "➤ Dungeon Data for " + mojang.name,
                        url: "https://sky.shiiyu.moe/stats/" + mojang.name,
                        iconURL: `https://crafatar.com/avatars/${mojang.id}?overlay`
                    })
                    .setThumbnail(this.client.user?.avatarURL()?.toString()!)
                    .addField("**Catacombs Info**", "Level: " + dungeons.cataLevel.toString() + ` [${this.formatter.format(Math.floor(dungeons.cataXp - cataLevels[Math.floor(parseFloat(dungeons.cataLevel.toString()))][1]))}/${this.formatter.format(cataLevels[Math.floor(parseFloat(dungeons.cataLevel.toString())) + 1][1] - cataLevels[Math.floor(parseFloat(dungeons.cataLevel.toString()))][1])}]` + "\n Class Average: " + classAvg.toString(),
                        false)
                    .addField("**Secrets** (" + secretAvg.toFixed(2) + "/run)", this.formatter.format(dungeons.secrets), true)
                    .addField("**Blood Mob Kills**", this.formatter.format(dungeons.bloodMobs), true)
                    .addField("**Total Completions**", this.formatter.format(totalCompletions), true)
                    .addField("**Master 5**", "S+ PB: " + (dungeons.masterFive ? fmtMSS(dungeons.masterFive) : "N/A") + "\nCompletions: " + this.formatter.format(dungeons.masterFiveCompletions), true)
                    .addField("**Master 6**", "S+ PB: " + (dungeons.masterSix ? fmtMSS(dungeons.masterSix) : "N/A") + "\nCompletions: " + this.formatter.format(dungeons.masterSixCompletions), true)
                    .addField("**Master 7**", "S+ PB: " + (dungeons.masterSeven ? fmtMSS(dungeons.masterSeven) : "N/A") + "\nCompletions: " + this.formatter.format(dungeons.masterSevenCompletions), true)
                    .addField("**Qualifications**",
                        `<@&${this.client.config.discord.roles.topPlayer.minus}> ${tpm}\n` +
                        `<@&${this.client.config.discord.roles.topPlayer.normal}> ${tp}\n` +
                        `<@&${this.client.config.discord.roles.topPlayer.plus}> ${tpp}`, true
                    )
                    .addField("ㅤ",
                        `<@&${this.client.config.discord.roles.misc.speedRunner}> ${speedrunner}\n` +
                        `<@&${this.client.config.discord.roles.misc.secretDuper}> ${secretDuper}\n` +
                        `<@&${this.client.config.discord.roles.topPlayer.votedOut}> ${votedOut}`, true
                    )
                    .setFooter(`${this.client.user?.username}` + (profile ? ` - Profile: ${profile.cute_name}` : " - No SkyBlock Profiles"), this.client.user?.avatarURL()?.toString())
                    .setColor("#B5FF59")
            ]
        })
    }
}