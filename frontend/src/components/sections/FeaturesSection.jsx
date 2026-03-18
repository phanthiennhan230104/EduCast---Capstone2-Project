import styles from "../../style/sections/FeaturesSection.module.css";

const features = [
  {
    icon: "🎧",
    title: "Podcast học thuật",
    desc: "Hàng nghìn tập podcast được kiểm duyệt bởi chuyên gia, phân loại theo chủ đề và trình độ của bạn.",
  },
  {
    icon: "🤝",
    title: "Study Room cộng đồng",
    desc: "Nghe cùng nhau theo thời gian thực. Thảo luận, đặt câu hỏi và chia sẻ ghi chú với bạn học toàn quốc.",
  },
  {
    icon: "📚",
    title: "Hành trình học tập",
    desc: "Theo dõi tiến độ, xây dựng streak hàng ngày và nhận phần thưởng khi đạt cột mốc học tập mới.",
  },
  {
    icon: "✍️",
    title: "Ghi chú thông minh",
    desc: "Đánh dấu đoạn hay, tự động tạo tóm tắt và xuất flashcard để ôn lại kiến thức hiệu quả.",
  },
  {
    icon: "🔔",
    title: "Feed cá nhân hoá",
    desc: "Thuật toán hiểu sở thích và mục tiêu của bạn, gợi ý đúng nội dung vào đúng thời điểm.",
  },
  {
    icon: "🎙️",
    title: "Creator Studio",
    desc: "Tạo và chia sẻ podcast học thuật của riêng bạn. Xây dựng cộng đồng học viên xung quanh chuyên môn của bạn.",
  },
];

export default function FeaturesSection() {
  return (
    <section className={styles.featuresSection}>
      <div className={styles.headingBlock}>
        <div className={styles.sectionEyebrow}>TÍNH NĂNG NỔI BẬT</div>

        <h2 className={styles.sectionTitle}>
          Học thông minh hơn,
          <br />
          <span>cùng cộng đồng.</span>
        </h2>
      </div>

      <div className={styles.featuresGrid}>
        {features.map((feature) => (
          <article key={feature.title} className={styles.featureCard}>
            <div className={styles.featureIcon}>{feature.icon}</div>
            <h3 className={styles.featureTitle}>{feature.title}</h3>
            <p className={styles.featureDesc}>{feature.desc}</p>
          </article>
        ))}
      </div>
    </section>
  );
}