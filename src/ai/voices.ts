export type VoiceGroupId = 'recommend' | 'female' | 'male' | 'service';

export type TtsVoice = {
  id: string;
  name: string;
  group: Exclude<VoiceGroupId, 'recommend'>;
  recommend?: boolean;
};

export const voiceGroups: { id: VoiceGroupId; label: string }[] = [
  { id: 'recommend', label: '面试推荐' },
  { id: 'female', label: '女声' },
  { id: 'male', label: '男声' },
  { id: 'service', label: '客服' },
];

/** 豆包语音合成 2.0 中文音色，偏面试/对话场景。 */
export const TTS_VOICES: TtsVoice[] = [
  { id: 'zh_male_m191_uranus_bigtts', name: '云舟 2.0', group: 'male', recommend: true },
  { id: 'zh_female_vv_uranus_bigtts', name: 'Vivi 2.0', group: 'female', recommend: true },
  { id: 'zh_female_xiaohe_uranus_bigtts', name: '小何 2.0', group: 'female', recommend: true },
  { id: 'zh_male_taocheng_uranus_bigtts', name: '小天 2.0', group: 'male', recommend: true },
  { id: 'zh_female_cancan_uranus_bigtts', name: '知性灿灿 2.0', group: 'female', recommend: true },
  { id: 'zh_male_ruyaqingnian_uranus_bigtts', name: '儒雅青年 2.0', group: 'male', recommend: true },
  { id: 'zh_female_kefunvsheng_uranus_bigtts', name: '暖阳女声 2.0', group: 'service', recommend: true },
  { id: 'zh_male_qingshuangnanda_uranus_bigtts', name: '清爽男大 2.0', group: 'male', recommend: true },
  { id: 'zh_female_zhixingnv_uranus_bigtts', name: '知性女声 2.0', group: 'female', recommend: true },
  { id: 'zh_male_yangguangqingnian_uranus_bigtts', name: '阳光青年 2.0', group: 'male', recommend: true },
  { id: 'zh_female_shuangkuaisisi_uranus_bigtts', name: '爽快思思 2.0', group: 'female' },
  { id: 'zh_female_qingxinnvsheng_uranus_bigtts', name: '清新女声 2.0', group: 'female' },
  { id: 'zh_female_tianmeixiaoyuan_uranus_bigtts', name: '甜美小源 2.0', group: 'female' },
  { id: 'zh_female_linjianvhai_uranus_bigtts', name: '邻家女孩 2.0', group: 'female' },
  { id: 'zh_female_wenroumama_uranus_bigtts', name: '温柔妈妈 2.0', group: 'female' },
  { id: 'zh_female_gaolengyujie_uranus_bigtts', name: '高冷御姐 2.0', group: 'female' },
  { id: 'zh_female_wenroushunv_uranus_bigtts', name: '温柔淑女 2.0', group: 'female' },
  { id: 'zh_female_kailangjiejie_uranus_bigtts', name: '开朗姐姐 2.0', group: 'female' },
  { id: 'zh_female_tiexinnvsheng_uranus_bigtts', name: '贴心女声 2.0', group: 'female' },
  { id: 'zh_female_qinqienv_uranus_bigtts', name: '亲切女声 2.0', group: 'female' },
  { id: 'zh_female_wenrouxiaoya_uranus_bigtts', name: '温柔小雅 2.0', group: 'female' },
  { id: 'zh_female_qingchezizi_uranus_bigtts', name: '清澈梓梓 2.0', group: 'female' },
  { id: 'zh_male_liufei_uranus_bigtts', name: '刘飞 2.0', group: 'male' },
  { id: 'zh_male_shaonianzixin_uranus_bigtts', name: '少年梓辛 2.0', group: 'male' },
  { id: 'zh_male_linjiananhai_uranus_bigtts', name: '邻家男孩 2.0', group: 'male' },
  { id: 'zh_male_wennuanahu_uranus_bigtts', name: '温暖阿虎 2.0', group: 'male' },
  { id: 'zh_male_jieshuoxiaoming_uranus_bigtts', name: '解说小明 2.0', group: 'male' },
  { id: 'zh_male_cixingjieshuonan_uranus_bigtts', name: '磁性解说男声 2.0', group: 'male' },
  { id: 'zh_male_gaolengchenwen_uranus_bigtts', name: '高冷沉稳 2.0', group: 'male' },
  { id: 'zh_male_shenyeboke_uranus_bigtts', name: '深夜播客 2.0', group: 'male' },
  { id: 'zh_male_yuanboxiaoshu_uranus_bigtts', name: '渊博小叔 2.0', group: 'male' },
  { id: 'zh_male_huolixiaoge_uranus_bigtts', name: '活力小哥 2.0', group: 'male' },
  { id: 'zh_male_wenrouxiaoge_uranus_bigtts', name: '温柔小哥 2.0', group: 'male' },
  { id: 'zh_male_dongfanghaoran_uranus_bigtts', name: '东方浩然 2.0', group: 'male' },
  { id: 'zh_male_youyoujunzi_uranus_bigtts', name: '悠悠君子 2.0', group: 'male' },
  { id: 'ICL_uranus_zh_female_kefuwanjun_tob', name: '客服婉君 2.0', group: 'service' },
  { id: 'ICL_uranus_zh_female_kailangtingting_tob', name: '开朗婷婷 2.0', group: 'service' },
  { id: 'ICL_uranus_zh_female_nuanxinqianqian_tob', name: '暖心茜茜 2.0', group: 'service' },
  { id: 'ICL_uranus_zh_female_lixingyuanzi_tob', name: '理性圆子 2.0', group: 'service' },
];

const uniqueVoices = (() => {
  const seen = new Set<string>();
  return TTS_VOICES.filter((voice) => {
    if (seen.has(voice.id)) {
      return false;
    }
    seen.add(voice.id);
    return true;
  });
})();

export function voicesInGroup(group: VoiceGroupId): TtsVoice[] {
  if (group === 'recommend') {
    return uniqueVoices.filter((voice) => voice.recommend);
  }
  return uniqueVoices.filter((voice) => voice.group === group);
}

export function voiceById(id: string): TtsVoice | undefined {
  return uniqueVoices.find((voice) => voice.id === id);
}

export function voiceLabel(id: string): string {
  return voiceById(id)?.name || id || '未选择音色';
}
