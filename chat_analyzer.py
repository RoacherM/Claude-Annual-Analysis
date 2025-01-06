from datetime import datetime
import pandas as pd
from utils import load_chat_data, tokenize


class ChatAnalyzer:
    def __init__(self, chat_data):
        self.chat_data = chat_data
        self.df = self._prepare_data()

    def _prepare_data(self):
        """预处理聊天数据，转换为DataFrame格式"""
        records = []
        for chat in self.chat_data:
            messages = chat["chat_messages"]
            user_msg, bot_msg = [], []

            # 首先按时间排序所有消息，时间相同时human排在assistant前
            sorted_messages = sorted(
                messages,
                key=lambda x: (
                    datetime.fromisoformat(x["created_at"].replace("Z", "+00:00")),
                    (
                        0 if x["sender"] == "human" else 1
                    ),  # human为0排在前面，assistant为1排在后面
                ),
            )

            # 记录第一个human消息的时间
            first_human_time = None
            last_assistant_time = None

            for msg in sorted_messages:
                try:
                    msg_time = datetime.fromisoformat(
                        msg["created_at"].replace("Z", "+00:00")
                    )

                    if msg["sender"] == "human":
                        if first_human_time is None:
                            first_human_time = msg_time
                        user_msg.append(msg["text"])
                    elif msg["sender"] == "assistant":
                        last_assistant_time = msg_time
                        bot_msg.append(msg["text"])

                except (ValueError, KeyError) as e:
                    print(f"Error processing message: {e}")
                    continue

            # 计算对话持续时间
            duration = 0
            if first_human_time and last_assistant_time:
                duration = (last_assistant_time - first_human_time).total_seconds()

            input_tokens = len(tokenize(" ".join(user_msg)))
            output_tokens = len(tokenize(" ".join(bot_msg)))

            # 提取每次对话的基本信息
            record = {
                "uuid": chat["uuid"],
                "name": chat["name"],
                "start_time": datetime.fromisoformat(
                    chat["created_at"].replace("Z", "+00:00")
                ),  # 将时间字符串转换为datetime
                "end_time": datetime.fromisoformat(
                    chat["updated_at"].replace("Z", "+00:00")
                ),
                "duration": duration,
                "dialogue_turns": len(chat["chat_messages"]) // 2 + 1,
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
            }
            records.append(record)

        return pd.DataFrame(records)

    def analyze_chat_duration(self):
        """分析对话时长统计"""
        avg_duration = self.df["duration"].mean()
        total_duration = self.df["duration"].sum()
        avg_turns = self.df["dialogue_turns"].mean()
        # 使用idxmax()获取最大值所在的索引
        longest_chat_idx = self.df["dialogue_turns"].idxmax()
        longest_chat = self.df.loc[longest_chat_idx]

        return {
            "average_duration": f"{avg_duration/3600:.2f} hrs",
            "total_duration": f"{total_duration/3600:.2f} hrs",
            "average_turns": avg_turns,
            "longest_chat": {
                "duration": f"{longest_chat["duration"]/3600:.2f} hrs",
                "name": longest_chat["name"],
            },
        }

    def analyze_time_patterns(self):
        """分析使用时间模式"""
        # 按小时统计
        hourly_pattern = (
            self.df.groupby(self.df["start_time"].dt.hour)["uuid"].count().to_dict()
        )

        # 按季节统计
        self.df["season"] = self.df["start_time"].dt.month % 12 // 3 + 1
        seasonal_pattern = self.df.groupby("season")["uuid"].count().to_dict()
        return {"hourly_pattern": hourly_pattern, "seasonal_pattern": seasonal_pattern}


def main():
    # 示例使用
    chat_data = load_chat_data("./data-2024-12-31-09-30-30/conversations.json")
    # print(chat_data[:3])
    for d in chat_data[:3]:
        # if d['name'] == "Provide PDF Preview or Sci-Hub Access Button":
        print(d["name"])
        sorted_messages = sorted(
            d["chat_messages"],
            key=lambda x: (
                datetime.fromisoformat(x["created_at"].replace("Z", "+00:00")),
                (
                    0 if x["sender"] == "human" else 1
                ),  # human为0排在前面，assistant为1排在后面
            ),
        )
        for m in sorted_messages:
            print(m["sender"], m["created_at"], m["text"][:20])

    analyzer = ChatAnalyzer(chat_data)

    # 1. Token使用分析
    # token_stats = analyzer.analyze_token_usage()

    # 2. 对话时长分析
    duration_stats = analyzer.analyze_chat_duration()

    # 3. 时间模式分析
    time_patterns = analyzer.analyze_time_patterns()

    # 输出分析结果
    print("=== Chat Analysis Results ===")
    print(f"\nAverage chat duration: {duration_stats['average_duration']}")
    print(f"Total chat duration: {duration_stats['total_duration']}")
    print(f"Average turns per chat: {duration_stats['average_turns']:.2f}")
    print(f"\nLongest chat: {duration_stats['longest_chat']['duration']}")
    print(f"Longest chat topic: {duration_stats['longest_chat']['name']}")


if __name__ == "__main__":
    main()
