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

        const mojang = await getMojang(username);
        if (mojang === "error" || !mojang) {
            return interaction.editReply({
                embeds: [
                    errorEmbed(`Could not find user \`${username}\`.`)
                ]
            })
        }

        const member = await this.fetchMember(user.id, interaction.guild as Guild);
        if (!member) {
            return interaction.editReply({
                embeds: [errorEmbed("That user is not in this server.")]
            });
        }

        if (apiCheck === false) {
            if (!cataLevel) {
                return interaction.editReply({
                    embeds: [errorEmbed("You must specify a Cata level if `api_check` is set to false.")]
                });
            }

            if (cataLevel < 0 || cataLevel > 60) {
                return interaction.editReply({
                    embeds: [errorEmbed("The Cata level must be between 0 and 60.")]
                });
            }

            let mongoUser = await this.mongo.getUser(mojang.id) as MongoUser | null | undefined;

            if (!mongoUser) {
                await this.mongo.addUser(userSchema(member.id, mojang.id));
                mongoUser = await this.mongo.getUser(mojang.id) as MongoUser | undefined;
            } else {
                if (mongoUser.discordId && mongoUser.discordId !== member.id && mongoUser.discordId !== null) {
                    const otherMember = await this.fetchMember(mongoUser.discordId, member.guild);
                    if (otherMember) {
                        if (!overrideDuplicate) {
                            return interaction.editReply({
                                embeds: [
                                    errorEmbed(`The minecraft account \`${mojang.name}\` is linked to a different discord account on this server (${otherMember.toString()}). Set override_duplicate to true to override.`)
                                ]
                            })
                        } else {
                            mongoUser.discordId = member.id;
                            if (otherMember.manageable) {
                                await otherMember.edit({
                                    nick: null,
                                    roles: this.client.config.discord.roles.fixRoles
                                })
                            }
                        }
                    } else {
                        mongoUser.discordId = member.id;
                    }
                } else {
                    mongoUser.discordId = member.id;
                }
            }

            if (member.roles.cache.has(this.client.config.discord.roles.topPlayer.votedOut)) {
                if (mongoUser) {
                    mongoUser.votedOut = true;
                }
            }

            if (member.roles.cache.has(this.client.config.discord.roles.topPlayer.plusReq)) {
                if (mongoUser) {
                    mongoUser.votedIn = true;
                }
            }

            if (mongoUser) await this.mongo.updateUser(mongoUser);

            const roles = this.arrayRoleIds(member.roles);

            if (cataLevel >= 30 && cataLevel <= 34) {
                if (!roles.includes(this.client.config.discord.roles.cata["30"])) {
                    roles.push(this.client.config.discord.roles.cata["30"]);
                }
            } else if (cataLevel >= 35) {
                if (!roles.includes(this.client.config.discord.roles.cata["35"])) {
                    roles.push(this.client.config.discord.roles.cata["35"]);
                }
            }

            if (!roles.includes(this.client.config.discord.roles.member)) {
                roles.push(this.client.config.discord.roles.member);
            }

            let symbol: string | undefined = undefined;

            for (const [key, value] of Object.entries(this.client.config.discord.symbols)) {
                if (roles.includes(key)) {
                    symbol = value
                }
            }

            const manager = new EmojiManager(member)
            await manager.update()
            await manager.sync()
            const emojis = manager.toString()

            let nickname = `❮${cataLevel}❯ ${mojang.name} ${emojis}`;
            if (symbol) nickname = nickname.replace(/[❮❯]/g, symbol)

            await member.edit({
                roles,
                nick: member.manageable ? nickname : undefined
            }, `Force verified as ${mojang.name} by ${interaction.user.tag}`)

            return interaction.editReply({
                embeds: [
                    embed("Force Verified!", `Successfully force verified <@${member.user.id}> as \`${mojang.name}\` and set their catacombs level to \`${cataLevel}\`.`)
                ]
            });
        }

        let discord;
        let player;
        try {
            player = await this.hypixel.player.uuid(mojang.id);
            discord = player.socialMedia?.links.DISCORD ?? player.socialMedia?.DISCORD;
        } catch (error: any) {
            console.error(error);
            return interaction.editReply({
                embeds: [
                    errorEmbed("There was an error while accessing the Hypixel API: " + error.message),
                ],
            });
        }

        if (!discord && !bypassDiscord) {
            return interaction.editReply({
                embeds: [
                    errorEmbed(
                        `There is no linked discord on Hypixel for the account \`${mojang.name}\`. Set bypass_discord to true to bypass this check.`
                    ),
                ],
            });
        }

        if (discord !== member.user.tag && !bypassDiscord) {
            return interaction.editReply({
                embeds: [
                    errorEmbed(
                        `The minecraft account \`${mojang.name}\`is linked to a different discord account on Hypixel. \n\nTheir Tag: ${member.user.tag}\nHypixel Tag: ${discord}\n\nSet bypass_discord to true to bypass this check.`
                    ),
                ],
            });
        }

        let mongoUser = await this.mongo.getUser(mojang.id) as MongoUser | null | undefined;

        if (!mongoUser) {
            await this.mongo.addUser(userSchema(member.id, mojang.id));
            mongoUser = await this.mongo.getUser(mojang.id) as MongoUser | undefined;
        } else {
            if (mongoUser.discordId && mongoUser.discordId !== member.id && mongoUser.discordId !== null) {
                const otherMember = await this.fetchMember(mongoUser.discordId, member.guild);
                if (otherMember) {
                    if (!overrideDuplicate) {
                        return interaction.editReply({
                            embeds: [
                                errorEmbed(`The minecraft account \`${mojang.name}\` is linked to a different discord account on this server (${otherMember.toString()}). Set override_duplicate to true to override.`)
                            ]
                        })
                    } else {
                        mongoUser.discordId = member.id;
                        if (otherMember.manageable) {
                            await otherMember.edit({
                                nick: null,
                                roles: this.client.config.discord.roles.fixRoles
                            })
                        }
                    }
                } else {
                    mongoUser.discordId = member.id;
                }
            } else {
                mongoUser.discordId = member.id;
            }
        }

        let roles = member.roles as GuildMemberRoleManager
        let rolesArray = this.arrayRoleIds(roles)

        let profile;
        try {
            profile = highestCataProfile(await this.hypixel.skyblock.profiles.uuid(mojang.id), mojang.id)
        } catch (error: any) {
            if (error.message === 'Key "profiles" is not an array.') {
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

        let dungeons;

        if (!profile) {
            dungeons = {
                cataLevel: cataLevel ?? 0,
                secrets: player.achievements.skyblock_treasure_hunter ?? 0,
                bloodMobs: 0,
                floorSeven: undefined,
                masterFive: undefined,
                masterSix: undefined
            }
        } else {
            dungeons = {
                cataLevel: cataLevel ?? Math.floor(convertXp(profile.members[mojang.id].dungeons?.dungeon_types.catacombs.experience ?? 0)),
                secrets: player.achievements.skyblock_treasure_hunter ?? 0,
                bloodMobs: (profile.members[mojang.id].stats.kills_watcher_summon_undead ?? 0) + (profile.members[mojang.id].stats.kills_watcher_summon_skeleton ?? 0) + (profile.members[mojang.id].stats.kills_master_watcher_summon_undead ?? 0),
                floorSeven: profile.members[mojang.id].dungeons?.dungeon_types.catacombs.fastest_time_s_plus?.[7] ?? undefined,
                masterFive: profile.members[mojang.id].dungeons?.dungeon_types.master_catacombs?.fastest_time_s_plus?.[5] ?? undefined,
                masterSix: profile.members[mojang.id].dungeons?.dungeon_types.master_catacombs?.fastest_time_s_plus?.[6] ?? undefined
            }
        }

        if (member.roles.cache.has(this.client.config.discord.roles.topPlayer.votedOut)) {
            if (mongoUser) {
                mongoUser.votedOut = true;
            }
        }

        if (member.roles.cache.has(this.client.config.discord.roles.topPlayer.plusReq)) {
            if (mongoUser) {
                mongoUser.votedIn = true;
            }
        }


        if (mongoUser) {
            await this.mongo.updateUser(mongoUser);
        }

        let tpp = false, tp = false, tpm = false, speedrunner = false, secretDuper = false;

        if ((dungeons.secrets >= 50000 || dungeons.bloodMobs >= 45000) && dungeons.cataLevel >= 48 && dungeons.masterSix) {
            if (dungeons.masterSix <= 195000 && !member.roles.cache.has(this.client.config.discord.roles.topPlayer.votedOut)) {
                tpp = true;
            }
        }

        if (member.roles.cache.has(this.client.config.discord.roles.topPlayer.plusReq)) {
            tpp = true;
        }

        if (!tpp && dungeons.cataLevel >= 45 && dungeons.secrets >= 30000 && (dungeons.floorSeven || dungeons.masterFive || dungeons.masterSix)) {
            if (dungeons.floorSeven && dungeons.floorSeven <= 225000) {
                tp = true;
            }
            if (dungeons.masterFive && dungeons.masterFive <= 150000) {
                tp = true;
            }
            if (dungeons.masterSix && dungeons.masterSix <= 225000) {
                tp = true;
            }
        }

        if ((!tp && !tpp) && dungeons.cataLevel >= 42 && dungeons.secrets >= 20000 && (dungeons.floorSeven || dungeons.masterFive)) {
            if (dungeons.floorSeven && dungeons.floorSeven <= 260000) {
                tpm = true;
            }
            if (dungeons.masterFive && dungeons.masterFive <= 165000) {
                tpm = true;
            }
        }

        if (tpp) tp = true;

        if (dungeons.masterSix) {
            if (dungeons.masterSix <= 170000) {
                speedrunner = true;
            }
        }

        if (dungeons.secrets >= 100000) {
            secretDuper = true;
        }

        for (const [, value] of Object.entries(this.client.config.discord.roles.cata)) {
            if (rolesArray.includes(value)) {
                rolesArray.splice(rolesArray.indexOf(value), 1)
            }
        }

        if (rolesArray.includes(this.client.config.discord.roles.topPlayer.plus)) {
            rolesArray.splice(rolesArray.indexOf(this.client.config.discord.roles.topPlayer.plus), 1)
        } else if (rolesArray.includes(this.client.config.discord.roles.topPlayer.normal)) {
            rolesArray.splice(rolesArray.indexOf(this.client.config.discord.roles.topPlayer.normal), 1)
        } else if (rolesArray.includes(this.client.config.discord.roles.topPlayer.minus)) {
            rolesArray.splice(rolesArray.indexOf(this.client.config.discord.roles.topPlayer.minus), 1)
        }

        if (tpp && !rolesArray.includes(this.client.config.discord.roles.topPlayer.plus)) {
            rolesArray.push(this.client.config.discord.roles.topPlayer.plus)
        }

        if (tp && !rolesArray.includes(this.client.config.discord.roles.topPlayer.normal)) {
            rolesArray.push(this.client.config.discord.roles.topPlayer.normal)
        }

        if (tpm && !rolesArray.includes(this.client.config.discord.roles.topPlayer.minus)) {
            rolesArray.push(this.client.config.discord.roles.topPlayer.minus)
        }

        if (speedrunner && !rolesArray.includes(this.client.config.discord.roles.misc.speedRunner)) {
            rolesArray.push(this.client.config.discord.roles.misc.speedRunner)
        }

        if (secretDuper && !rolesArray.includes(this.client.config.discord.roles.misc.secretDuper)) {
            rolesArray.push(this.client.config.discord.roles.misc.secretDuper)
        }

        if (dungeons.cataLevel < 30 || dungeons.cataLevel > 60) {

        } else if (dungeons.cataLevel >= 30 && dungeons.cataLevel <= 34) {
            rolesArray.push(this.client.config.discord.roles.cata["30"])
        } else if (dungeons.cataLevel >= 35 && dungeons.cataLevel <= 39) {
            rolesArray.push(this.client.config.discord.roles.cata["35"])
        } else {
            if (!tpp && !tp && !tpm) {
                rolesArray.push(this.client.config.discord.roles.cata["35"])
            } else {
                // @ts-ignore
                rolesArray.push(this.client.config.discord.roles.cata[dungeons.cataLevel.toString()])
            }
        }

        let symbol: string | undefined = undefined;

        for (const [key, value] of Object.entries(this.client.config.discord.symbols)) {
            if (rolesArray.includes(key)) {
                symbol = value
            }
        }

        const manager = new EmojiManager(member)
        await manager.update()
        await manager.sync()
        const emojis = manager.toString()

        let nickname = `❮${dungeons.cataLevel}❯ ${mojang.name} ${emojis}`;
        if (symbol) nickname = nickname.replace(/[❮❯]/g, symbol)

        if (!rolesArray.includes(this.client.config.discord.roles.member)) {
            rolesArray.push(this.client.config.discord.roles.member)
        }

        await member.edit({
            nick: member.manageable ? nickname : undefined,
            roles: rolesArray,
        }, `Force verified as ${mojang.name} by ${interaction.user.tag}`)

        const stats = "Catacombs Level: " + dungeons.cataLevel
            + "\nSecrets: " + dungeons.secrets
            + "\nBlood Mob Kills: " + dungeons.bloodMobs
            + "\nFloor 7 S+: " + (dungeons.floorSeven ? fmtMSS(dungeons.floorSeven!) : "N/A")
            + "\nMaster Five S+: " + (dungeons.masterFive ? fmtMSS(dungeons.masterFive!) : "N/A")
            + "\nMaster Six S+: " + (dungeons.masterSix ? fmtMSS(dungeons.masterSix!) : "N/A")

        return interaction.editReply({
            embeds: [
                new MessageEmbed()
                    .setTitle(`Verified!`)
                    .setDescription(`Successfully force verified <@${member.user.id}> as \`${mojang.name}\`!`)
                    .addField("**Stats Overview**", stats)
                    .setFooter(client.user?.username as string, client.user?.avatarURL()?.toString())
                    .setColor("#B5FF59")
                    .setTimestamp()
            ]
        })

    }
}