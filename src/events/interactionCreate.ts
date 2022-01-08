import { Interaction, GuildMember } from "discord.js";
import { DungeonGang } from "../index"
import PollManager from "../util/PollManager";
import EmojiManager from "../util/EmojiManager";


module.exports = class {
    client: DungeonGang
    constructor(client: DungeonGang) {
        this.client = client;
    }
    async run(interaction: Interaction) {
        if (interaction.isCommand()) {
            const command = interaction.commandName
            const cmd = this.client.commands.get(command);
            if (!cmd) return;
            if (cmd && !interaction.guild && cmd.conf.guildOnly)
                return interaction.reply(
                    "This command is unavailable via private message. Please run this command in a guild."
                );
            const level = this.client.getPermissionLevel(interaction.member as GuildMember | null);
            if (level < cmd.conf.permLevel)
                return interaction.reply({
                    content: "You don't have permission to use this command + cry about it + stay mad + get real + L + mald seethe cope harder + hoes mad + basic + skill issue + ratio + you fell off + the audacity + triggered + any askers + redpilled + get a life + ok and? + cringe + touch grass + donowalled + not based + your're (french) + not funny didn't laugh + you're + grammar issue + go outside + get good + reported + ad hominem + GG! + ur mom",
                    ephemeral: true
                });
            interaction.user.permLevel = level;
            cmd.execute(interaction);
        }

        if (interaction.isContextMenu()) {
            let command = interaction.commandName;
            if (command === "Dungeon Stats") {
                command = "cata";
            }
            if (command === "Exp Calculator") {
                command = "calc";
            }
            if (command === "Force Update") {
                command = "forceupdate";
            }
            const cmd = this.client.commands.get(command);
            if (!cmd) return;
            if (cmd && !interaction.guild && cmd.conf.guildOnly)
                return interaction.reply(
                    "This command is unavailable via private message. Please run this command in a guild."
                );
            const level = this.client.getPermissionLevel(interaction.member as GuildMember | null);
            if (level < cmd.conf.permLevel)
                return interaction.reply({
                    content: "You don't have permission to use this command.",
                    ephemeral: true
                });
            interaction.user.permLevel = level;
            cmd.execute(interaction);
        }

        if (interaction.isSelectMenu()) {
            if (interaction.customId.startsWith("POLLS_COMMAND_MENU_")) {
                return PollManager.onSelect(interaction);
            }
        }

        if (interaction.isButton()) {
            if (["POSITIVE_VOTE", "NEUTRAL_VOTE", "NEGATIVE_VOTE", "END_POLL"].includes(interaction.customId)) {
                return PollManager.onInteraction(interaction);
            }
        }
        if (interaction.isAutocomplete()) {
            if (["equip", "give", "take"].includes(interaction.commandName)) {
                return EmojiManager.autocomplete(interaction);
            }
            if (interaction.commandName === "requirements") {
                if (interaction.options.getSubcommand(true) === "set") {
                    return this.client.commands.get("requirements").autocomplete(interaction);
                }
            }
        }
    }
}