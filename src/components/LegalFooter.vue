<script setup lang="ts">
import { correspondingSourceUrl } from '../legal'

const sourceUrl = correspondingSourceUrl(
  import.meta.env.VITE_SOURCE_URL,
  import.meta.env.VITE_SOURCE_REVISION,
)
const noticesUrl = `${import.meta.env.BASE_URL}legal/THIRD_PARTY_NOTICES.txt`
</script>

<template>
  <footer class="legal-footer">
    <p>
      非官方、非商業的玩家工具。© SQUARE ENIX。FINAL FANTASY 是 Square Enix Holdings Co.,
      Ltd. 的註冊商標。本專案與 Square Enix 無關，亦未獲其背書。
    </p>
    <nav aria-label="來源與授權">
      <a v-if="sourceUrl" :href="sourceUrl">此部署版本的完整對應原始碼</a>
      <span v-else>本機建置：部署流程尚未注入對應原始碼網址</span>
      <a href="https://www.gnu.org/licenses/agpl-3.0.html">AGPL-3.0-or-later</a>
      <a href="https://github.com/Isla-Liu/ffxiv-best-craft-zhtw">BestCraft 繁中來源</a>
      <a href="https://github.com/KonaeAkira/raphael-rs">Raphael 求解器</a>
      <a href="https://support.na.square-enix.com/rule.php?id=5382&la=1&tag=authc">
        FFXIV Materials Usage License
      </a>
      <a :href="noticesUrl">第三方聲明</a>
    </nav>
  </footer>
</template>
