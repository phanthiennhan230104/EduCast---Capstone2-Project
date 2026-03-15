import { useState } from 'react'
import PodcastCard from './PodcastCard'
import styles from '../../style/feed/Feed.module.css'

const TABS = ['Dành cho bạn', 'Đang theo dõi', 'Xu hướng', 'Mới nhất']

const PODCASTS = [
  {
    id: 1,
    title: 'Python cho AI: Từ cơ bản đến nâng cao – Tập 3',
    author: 'Minh Khoa AI',
    avatar: 'https://i.pravatar.cc/40?img=3',
    cover: 'https://picsum.photos/seed/py3/160/160',
    description: 'Hôm nay chúng ta sẽ học về pandas, numpy và cách xử lý dữ liệu để chuẩn bị cho các mô hình machine learning. Series này phù hợp cho người mới bắt đầu.',
    tags: ['#Python', '#AI', '#MachineLearning'],
    aiGenerated: true,
    duration: '18:45',
    current: '05:12',
    progress: 28,
    likes: 142,
    comments: 37,
  },
  {
    id: 2,
    title: 'Tâm lý học hành vi: Tại sao chúng ta trì hoãn?',
    author: 'Dr. Anh Nguyễn',
    avatar: 'https://i.pravatar.cc/40?img=7',
    cover: 'https://picsum.photos/seed/psych/160/160',
    description: 'Trì hoãn không phải là lười biếng – đó là một cơ chế điều tiết cảm xúc. Trong tập này chúng ta sẽ khám phá nguyên nhân tâm lý và cách vượt qua.',
    tags: ['#TâmLý', '#PháttriểnBảnThân'],
    aiGenerated: false,
    duration: '24:10',
    current: '00:00',
    progress: 0,
    likes: 289,
    comments: 64,
  },
  {
    id: 3,
    title: 'Web3 và Blockchain giải thích đơn giản – Phần 2',
    author: 'CryptoViet',
    avatar: 'https://i.pravatar.cc/40?img=15',
    cover: 'https://picsum.photos/seed/web3/160/160',
    description: 'Smart contract, DeFi, NFT không còn xa lạ sau tập này. Cùng khám phá cách các dApp vận hành trên nền tảng Ethereum và Solana.',
    tags: ['#Blockchain', '#Web3', '#DeFi'],
    aiGenerated: true,
    duration: '32:05',
    current: '12:00',
    progress: 37,
    likes: 98,
    comments: 22,
  },
  {
    id: 4,
    title: 'React 19 có gì mới? – Deep dive vào Server Components',
    author: 'Frontend Việt',
    avatar: 'https://i.pravatar.cc/40?img=22',
    cover: 'https://picsum.photos/seed/react19/160/160',
    description: 'Tìm hiểu về React Server Components, use() hook, Actions và những thay đổi quan trọng trong React 19 ảnh hưởng đến cách bạn xây dựng ứng dụng.',
    tags: ['#ReactJS', '#Frontend', '#JavaScript'],
    aiGenerated: false,
    duration: '41:30',
    current: '00:00',
    progress: 0,
    likes: 321,
    comments: 89,
  },
]

export default function Feed() {
  const [activeTab, setActiveTab] = useState(0)

  return (
    <section className={styles.feed}>
      {/* Tabs */}
      <div className={styles.tabs}>
        {TABS.map((tab, i) => (
          <button
            key={tab}
            className={`${styles.tab} ${activeTab === i ? styles.active : ''}`}
            onClick={() => setActiveTab(i)}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Cards */}
      <div className={styles.cards}>
        {PODCASTS.map(podcast => (
          <PodcastCard key={podcast.id} podcast={podcast} />
        ))}
      </div>
    </section>
  )
}
