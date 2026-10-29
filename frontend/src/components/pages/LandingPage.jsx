import React, { useId, useRef, useState } from 'react';
import Icon from '../common/Icon';
import Modal from '../common/Modal';
import ThemeToggle from '../common/ThemeToggle';
import LandingPlayground, { landingTopics } from '../features/LandingPlayground';

const topicNotes = {
  校园生活: ['一起收集校园的小事', '食堂的新发现、路上的晚霞、今天的小确幸，都值得有人听见。', 'park'],
  学习交流: ['一个人卡住的题，一起想想', '课程怎么选、作业怎么做、复习从哪开始，把问题放到同学中间。', 'forum'],
  求助: ['需要搭把手的时候，开个口', '问一条路，找一个建议。有些小问题，说出来就有了新的方向。', 'chat_bubble'],
};

export default function LandingPage({ onGetStarted, onLogin, onRegister }) {
  const [activeModal, setActiveModal] = useState(null);
  const [topic, setTopic] = useState('');
  const experienceRef = useRef(null);
  const scrollToExperience = () => {
    experienceRef.current?.scrollIntoView({ behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    experienceRef.current?.focus({ preventScroll: true });
  };
  const aboutTitleId = useId();
  const privacyTitleId = useId();

  return (
    <>
      <div className="welcome-page">
        <header className="welcome-nav">
          <button className="welcome-brand" type="button" aria-label="NJU 树洞，回到顶部" onClick={() => window.scrollTo({ top: 0, behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })}>
            <span className="brand-mark"><Icon name="park" /></span>
            <span>南大树洞<small>NJU TREEHOLE</small></span>
          </button>
          <nav className="welcome-section-nav" aria-label="页面导览"><button type="button" onClick={scrollToExperience}>互动体验</button><a href="#welcome-topics">校园话题</a><a href="#welcome-questions">常见问题</a></nav>
          <div className="welcome-nav-actions">
            <ThemeToggle />
            <button type="button" className="welcome-login" onClick={onLogin}>登录</button>
            <button type="button" className="secondary-button" onClick={onRegister}>注册 <Icon name="arrow_forward" /></button>
          </div>
        </header>
        <main>
          <section className="welcome-hero">
            <div className="welcome-copy">
              <p className="welcome-eyebrow"><span className="welcome-kicker-line" /> 在南大，有话慢慢说</p>
              <h1>把想说的话，<br />留在<span>树洞</span>里。</h1>
              <p className="welcome-lead">生活里的小事，学习中的困惑，<br />还有那些想被听见的心情。</p>
              <p className="welcome-subcopy">有人和你有同样的问题，也有人愿意听完。<br />从一条树洞，认识校园的另一面。</p>
              <div className="welcome-actions">
                <button className="primary-button" type="button" onClick={onGetStarted}>开始使用 <Icon name="arrow_forward" /></button>
                <button className="welcome-text-button" type="button" onClick={scrollToExperience}>先体验一下 <Icon name="arrow_forward" /></button>
              </div>
              <p className="welcome-footnote"><Icon name="masks" /> 匿名交流 · 校园日常 · 友善回应</p>
            </div>
            <div className="welcome-experience" ref={experienceRef} tabIndex={-1}>
              <div className="welcome-experience-caption"><span>先逛一小会儿</span><span>不用登录，直接点点看 <Icon name="arrow_forward" /></span></div>
              <LandingPlayground topic={topic} onTopicChange={setTopic} onRegister={onRegister} />
            </div>
          </section>
          <section className="welcome-topics" id="welcome-topics" aria-labelledby="welcome-topics-title">
            <div className="welcome-topics-heading"><p className="welcome-eyebrow">校园没有标准答案</p><h2 id="welcome-topics-title">今天，想聊哪件事？</h2><p>大到新的选择，小到下一顿吃什么。</p></div>
            <div className="welcome-topic-picker">
              <div className="welcome-topic-tabs" aria-label="选择体验话题">{landingTopics.map(item => <button type="button" key={item} aria-pressed={(topic || '校园生活') === item} onClick={() => setTopic(item)}><Icon name={topicNotes[item][2]} />{item}</button>)}</div>
              <div className="welcome-topic-story"><span>#{topic || '校园生活'}</span><h3>{topicNotes[topic || '校园生活'][0]}</h3><p>{topicNotes[topic || '校园生活'][1]}</p><button type="button" className="welcome-text-button" onClick={() => { setTopic(topic || '校园生活'); scrollToExperience(); }}>看看这个话题 <Icon name="arrow_forward" /></button></div>
            </div>
          </section>
          <section className="welcome-intro">
            <div className="welcome-intro-heading"><p className="welcome-eyebrow">留一点空间给自己</p><h2>不必认识，<br />也能好好说话。</h2><p>阅读时安静一点，表达时轻松一点。<br />用熟悉的方式，继续每一次交流。</p><a className="welcome-text-button" href="#welcome-questions">还有几个小问题 <Icon name="expand_more" /></a></div>
            <div className="welcome-principles">
              <article><span>01</span><div><h3>分享，不用先介绍自己</h3><p>一件小事、一个问题，或者今天的心情，都可以成为交流的开始。</p></div><Icon name="edit_square" /></article>
              <article><span>02</span><div><h3>找到属于你的共鸣</h3><p>用话题和搜索发现感兴趣的讨论，把想再读的内容放进收藏。</p></div><Icon name="forum" /></article>
              <article><span>03</span><div><h3>自由表达，也相互尊重</h3><p>同帖身份保持一致，方便继续对话。遇到不友善的内容，可以提交举报。</p></div><Icon name="verified_user" /></article>
            </div>
          </section>
          <section className="welcome-questions" id="welcome-questions" aria-labelledby="welcome-questions-title">
            <div><p className="welcome-eyebrow">开始之前</p><h2 id="welcome-questions-title">你可能想问</h2><p>了解一点，再决定怎么参与。</p></div>
            <div className="welcome-faq-list">
              <details><summary>这里的示例真的可以操作吗？<Icon name="add" /></summary><p>可以。点开帖子可以看讨论，也能点赞、收藏、写回复和试发文字。体验内容只在当前页面保留，刷新或点击“重置体验”就会清空，不会发布到社区。</p></details>
              <details><summary>发帖和回复时，会显示什么身份？<Icon name="add" /></summary><p>社区使用匿名身份参与讨论，同一帖子内保持一致，方便接着聊。匿名交流也需要尊重彼此，不要在内容中公开自己或他人的敏感信息。</p></details>
              <details><summary>正式参与讨论，需要登录吗？<Icon name="add" /></summary><p>需要。上方体验区可以直接试用；想发布真实内容、参与讨论或保存收藏，可以先创建账号，再登录进入树洞。</p><button type="button" className="welcome-text-button" onClick={onRegister}>去创建账号 <Icon name="arrow_forward" /></button></details>
              <details><summary>遇到不友善的内容怎么办？<Icon name="add" /></summary><p>帖子和评论提供举报入口。可以选择原因并补充说明，交由管理员处理。不必勉强自己参与让你不舒服的对话。</p></details>
            </div>
          </section>
          <section className="welcome-closing"><span className="welcome-closing-tree" aria-hidden="true"><Icon name="park" /></span>
            <div><p className="welcome-eyebrow">你好，南大同学</p><h2>今天，想从哪句话开始？</h2></div>
            <div className="welcome-actions"><button className="primary-button" type="button" onClick={onGetStarted}>进入树洞 <Icon name="arrow_forward" /></button><button className="secondary-button" type="button" onClick={onRegister}>创建账号</button></div>
          </section>
        </main>
        <footer className="welcome-footer"><span>南大树洞 · NJU Treehole</span><div><button type="button" onClick={() => setActiveModal('about')}>关于我们</button><button type="button" onClick={() => setActiveModal('privacy')}>隐私政策</button></div></footer>
      </div>
      <Modal isOpen={activeModal === 'about'} onClose={() => setActiveModal(null)} labelledBy={aboutTitleId}>
        <div className="p-6 max-sm:p-4">
          <div className="mb-6 flex items-center justify-between">
            <h2 id={aboutTitleId} className="text-xl font-bold tracking-tight">关于 NJU 树洞</h2>
            <button
              type="button"
              aria-label="关闭关于我们弹窗"
              className="grid h-8 w-8 place-items-center rounded-full text-text-2 transition-colors hover:bg-surface-soft"
              onClick={() => setActiveModal(null)}
            >
              <Icon name="close" />
            </button>
          </div>
          <div className="space-y-4 text-sm leading-relaxed text-text-2">
            <p>
              NJU树洞是面向南京大学师生的半匿名表达与互助交流平台。我们致力于为南大学子提供一个温暖、安全、低压力的表达空间。
            </p>
            <p>
              在这里，你可以分享心情、寻求帮助、交流想法，也可以只是安静地记录自己的一天。
              每位用户在同一帖子内身份一致，但不同帖子之间完全隔离，无法被跨帖关联。
            </p>
            <p>
              平台由南京大学在校学生团队开发与运营，核心设计理念围绕「帖子级匿名」「低压力表达」「有边界的自由」展开，
              旨在平衡匿名表达的自由与社区治理的责任。
            </p>
          </div>
        </div>
      </Modal>

      <Modal isOpen={activeModal === 'privacy'} onClose={() => setActiveModal(null)} labelledBy={privacyTitleId}>
        <div className="p-6 max-sm:p-4">
          <div className="mb-6 flex items-center justify-between">
            <h2 id={privacyTitleId} className="text-xl font-bold tracking-tight">隐私政策</h2>
            <button
              type="button"
              aria-label="关闭隐私政策弹窗"
              className="grid h-8 w-8 place-items-center rounded-full text-text-2 transition-colors hover:bg-surface-soft"
              onClick={() => setActiveModal(null)}
            >
              <Icon name="close" />
            </button>
          </div>
          <div className="space-y-5 text-sm leading-relaxed text-text-2">
            <section>
              <h3 className="mb-1 font-semibold text-text">1. 信息的收集与使用</h3>
              <p>我们仅收集提供服务所必需的信息，包括注册时提供的校园邮箱或学号，以及你主动发布的帖子、评论等内容。这些信息仅用于平台正常运营与内容治理。</p>
            </section>
            <section>
              <h3 className="mb-1 font-semibold text-text">2. 匿名机制</h3>
              <p>你的真实身份不会与帖子内容公开关联。系统通过不可逆的哈希算法为每个帖子生成临时匿名身份，同一帖子内身份一致便于连续讨论，不同帖子之间完全隔离。平台管理员在必要时可追溯发帖人身份以履行治理义务。</p>
            </section>
            <section>
              <h3 className="mb-1 font-semibold text-text">3. 数据存储与安全</h3>
              <p>你的数据存储在国内合规服务器上，传输采用加密协议。我们采取合理的安全措施保护你的个人信息，但无法保证绝对安全。如发生数据泄露，我们将依法及时告知。</p>
            </section>
            <section>
              <h3 className="mb-1 font-semibold text-text">4. 信息共享</h3>
              <p>我们不会将你的个人信息出售给第三方。在法律法规要求、保护平台权益或维护校园安全等必要情况下，我们可能依法披露必要信息。</p>
            </section>
            <section>
              <h3 className="mb-1 font-semibold text-text">5. 你的权利</h3>
              <p>你可以随时查看、修改或删除你的个人信息与发布内容。注销账号后，与你关联的个人信息将被删除或匿名化处理。</p>
            </section>
            <section>
              <h3 className="mb-1 font-semibold text-text">6. 政策更新</h3>
              <p>本隐私政策可能不时更新。重大变更将通过平台通知告知你。继续使用本平台即表示你同意更新后的政策。</p>
            </section>
            <p className="border-t border-line-soft pt-2 text-xs text-text-3">最近更新：2026 年 5 月</p>
          </div>
        </div>
      </Modal>
    </>
  );
}
