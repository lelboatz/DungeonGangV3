import { Interaction, GuildMember } from "discord.js";
import { DungeonGang } from "../index"


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
                    content: "You don't have permission to use that command!",
                    ephemeral: true
                });
            interaction.user.permLevel = level;
            cmd.execute(interaction);
        }
    }
}