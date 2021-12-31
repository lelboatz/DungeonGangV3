import BaseCommand from "../BaseCommand";
import { DungeonGang } from "../../index";
import { SlashCommandBuilder } from "@discordjs/builders";
import { CommandInteraction, GuildMember } from "discord.js";
import { ephemeralMessage, errorEmbed } from "../../util/Functions";
import EmojiManager from "../../util/EmojiManager";

module.exports = class EmojiCommand extends BaseCommand {
    constructor(client: DungeonGang) {
        super(client, {
            name: "emotes",
            description: "Shows all available emotes and slots.",
            category: "Emotes",
            usage: "emotes",
            guildOnly: true,
            permLevel: 0,
            slashCommandBody: new SlashCommandBuilder()
                .setName("emotes")
                .setDescription("Shows all available emotes and slots.")
        });
    }
    async execute(interaction: CommandInteraction) {
        await interaction.deferReply({
            ephemeral: ephemeralMessage(interaction.channelId)
        })
        const user = await this.mongo.getUserByDiscord(interaction.user.id)

        if (!user) {
            return interaction.editReply({
                embeds: [
                    errorEmbed("You must be verified to use this command. Please verify with /verify and try again.")
                ]
            })
        }

        const manager = new EmojiManager(interaction.member as GuildMember)

        await manager.update()
        await manager.sync()

        const slots = []

        let i = 1;

        for (const [key, value] of Object.entries(manager.slots)) {
            slots.push({
                name: "**Slot " + i + ": " + this.toProperCase(key) + "**",
                value: "`" + value + "`",
                inline: true
            })
            i++;
        }

        let available = manager.emotes.length > 0 ? "Available Emotes: `" + manager.emotes.join(", ") + "`" : "Available Emotes: None"

        if (manager.toString().length > 0) {
            available += "\nPreview: `" + manager.toString() + "`"
        }

        return interaction.editReply({
            embeds: [
                {
                    title: "Emotes",
                    description: available,
                    fields: slots,
                    color: "#B5FF59"
                }
            ]
        })

    }
}