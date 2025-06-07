此项目已经弃用，请转到https://github.com/mimangxiaoye/vscode-Cursor-Position-S
目前发现问题：扩展设置无法修改。现在还没修复
Currently known issue: extension settings cannot be modified. Not yet fixed.
插件在Releases 预发布版本在tags里面
The plugin is in Releases, and the pre-release versions are under Tags.
中文：  
我一直想找一个关闭整个vscode可以自动回到上次光标位置的插件，不知道是我搜索还是英文名或者是根本就没有这个插件。我没找到，所以就用ai写了这个插件 住：使用gpt ai翻译不确保对不对。
这个插件是我用claude，ai编写出来的代码，作用是防止你为了躲避某人或者不小心点出了vscode导致源文件的光标位置忘记或者不想再从文章最上面重新找到上次光标位置。所以就做了这个插件，在设置里面搜索Cursor Position Saver这个会找到扩展的设置当然是中文的，因为本人一点编程也不会，英语也不会，用ai翻译的。哈哈哈。学习还要很长的时间，如果有大佬来帮我一起完成这个项目最好了。一直开源。因为我本来就是想着方便大家。
解释1下，扩展设置的详细信息，我也不知道claude搞得行不行：从搜索Cursor Position Saver按上到下排序
1.是否启用关闭整个vscode光标保存
2.保存在本地计算机的文件数量（按照最新保存时间）
3.保存光标的时间（顾名思义，就是保存的时间。我也不知道gpt能不能翻译中文成语）
4.保存的位置 1.c盘用户文件你的用户名mycode 比如：C:\Users\你的用户名\mycode\cursor-positions.json 2.d盘 mycode
5.提示保存光标的时间（右下角会提示这个文件光标保存的信息，） 插件在Releases 预发布版本在tags 里面 至于文件大小，我也搞不明白为什么这么大，问ai也没问明白，甚至让我冲钱，可惜没钱没法发消息了
----------------------------------------就这5个设置剩下的不是-----------------------------------------------




English：GPT-based AI Translation
I’ve always wanted a plugin that could restore the last cursor position after completely closing VS Code. I tried searching for it, but maybe I didn’t use the right English keywords—or maybe such a plugin simply didn’t exist. So I used AI to help me write this one.

This plugin was created using Claude AI. Its purpose is to help you remember your last editing position, especially if you accidentally close VS Code, switch windows to avoid someone, or just don’t want to scroll back from the top every time.

You can find the plugin settings by searching “Cursor Position Saver” in VS Code’s settings. The setting labels are in Chinese, because I don’t know programming or English well—I used AI for translation, haha . Still learning! If someone more experienced is willing to help improve this project, that would be amazing. It’s open-source and always will be. I just want it to help others like me.

🛠 Plugin Settings Explanation (listed from top to bottom):
Enable cursor position saving when VS Code closes completely

Number of files to save (based on most recent save time)

Save interval (how often the cursor positions are saved; not sure if GPT can properly translate Chinese idioms hahaha)

Save location

C:\Users\<your-username>\mycode\cursor-positions.json

or D:\mycode

Show cursor save time in notification (a message will pop up in the lower right corner showing that the cursor was saved) The plugin is in Releases, and the pre-release versions are under Tags. “As for the file size, I don’t really understand why it’s so big. I asked AI but didn’t get a clear answer. It even suggested I pay, but unfortunately, I don’t have money and can’t send messages.”

------------That’s all! The rest of the settings aren’t really used for now.---------------
